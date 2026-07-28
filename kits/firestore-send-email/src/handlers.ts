/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  FieldValue,
  type Firestore,
  Timestamp,
} from "firebase-admin/firestore";
import type { Transporter } from "nodemailer";
import * as events from "./events";
import type { ResolvedSendEmailConfig } from "./export-config";
import * as logs from "./logs";
import { preparePayload } from "./prepare-payload";
import type { Templates } from "./templates";
import type { Delivery, QueuePayload } from "./types";

export interface HandlerContext {
  db: Firestore;
  transport: Transporter;
  templates?: Templates;
  config: ResolvedSendEmailConfig;
}

export interface DocumentWriteEvent {
  data?: {
    before: any;
    after: any;
  };
}

function getExpireAt(startTime: Timestamp, config: ResolvedSendEmailConfig) {
  const date = startTime.toDate();
  const value = config.ttlExpireValue;
  switch (config.ttlExpireType) {
    case "hour":
      date.setHours(date.getHours() + value);
      break;
    case "day":
      date.setDate(date.getDate() + value);
      break;
    case "week":
      date.setDate(date.getDate() + value * 7);
      break;
    case "month":
      date.setMonth(date.getMonth() + value);
      break;
    case "year":
      date.setFullYear(date.getFullYear() + value);
      break;
    default:
      throw new Error(`Unknown TTL expire type: ${config.ttlExpireType}`);
  }
  return Timestamp.fromDate(date);
}

async function deliver(ref: any, ctx: HandlerContext): Promise<void> {
  const snapshot = await ref.get();
  if (!snapshot.exists) return;

  let payload = snapshot.data() as QueuePayload;
  if (payload.delivery?.state !== "PROCESSING") {
    return;
  }

  logs.attemptingDelivery(ref);

  const update: Record<string, unknown> = {
    "delivery.attempts": FieldValue.increment(1),
    "delivery.endTime": FieldValue.serverTimestamp(),
    "delivery.error": null,
    "delivery.leaseExpireTime": null,
  };

  try {
    payload = await preparePayload(payload, {
      db: ctx.db,
      config: ctx.config,
      templates: ctx.templates,
    });

    const to = Array.isArray(payload.to) ? payload.to : [];
    const cc = Array.isArray(payload.cc) ? payload.cc : [];
    const bcc = Array.isArray(payload.bcc) ? payload.bcc : [];

    if (!to.length && !cc.length && !bcc.length) {
      throw new Error(
        "Failed to deliver email. Expected at least 1 recipient."
      );
    }

    const mailOptions: any = {
      from: payload.from || ctx.config.defaultFrom,
      replyTo: payload.replyTo || ctx.config.defaultReplyTo,
      to,
      cc,
      bcc,
      subject: payload.message?.subject,
      text: payload.message?.text,
      html: payload.message?.html,
      headers: payload.headers,
      attachments: payload.message?.attachments,
      categories: payload.categories,
      templateId: payload.sendGrid?.templateId,
      dynamicTemplateData: payload.sendGrid?.dynamicTemplateData,
      mailSettings: payload.sendGrid?.mailSettings,
      customArgs: payload.sendGrid?.customArgs,
      ipPoolName: payload.sendGrid?.ipPoolName,
    };

    logs.info("Sending via transport.sendMail()", { mailOptions });
    const result = (await ctx.transport.sendMail(mailOptions as any)) as any;
    const info = {
      messageId: result.messageId || null,
      sendgridQueueId: result.queueId || null,
      accepted: result.accepted || [],
      rejected: result.rejected || [],
      pending: result.pending || [],
      response: result.response || null,
    };

    update["delivery.state"] = "SUCCESS";
    update["delivery.info"] = info;
    logs.delivered(ref, info);
  } catch (error) {
    update["delivery.state"] = "ERROR";
    update["delivery.error"] = (error as Error).toString();
    logs.deliveryError(ref, error as Error);
  }

  return ctx.db.runTransaction((transaction) => {
    transaction.update(ref, update);
    return Promise.resolve();
  });
}

async function processWrite(
  change: { before: any; after: any },
  ctx: HandlerContext
) {
  const ref = change.after.ref;

  if (change.after.exists) {
    const payloadAfter = change.after.data() as QueuePayload;
    if (payloadAfter?.delivery?.state === "SUCCESS") return;
    if (payloadAfter?.delivery?.state === "ERROR") return;
  }

  const shouldAttemptDelivery = await ctx.db.runTransaction<boolean>(
    async (transaction) => {
      const snapshot: any = await transaction.get(ref);
      if (!snapshot.exists) return false;

      const payload = snapshot.data() as QueuePayload;
      if (
        typeof payload.message !== "object" &&
        !payload.template &&
        typeof payload.sendGrid !== "object"
      ) {
        logs.invalidMessage(payload.message);
        return false;
      }

      if (!payload.delivery) {
        const startTime = Timestamp.fromDate(new Date());
        const delivery: Partial<Delivery> = {
          startTime,
          state: "PENDING",
          attempts: 0,
          error: null,
        };
        if (ctx.config.ttlExpireType && ctx.config.ttlExpireType !== "never") {
          delivery.expireAt = getExpireAt(startTime, ctx.config);
        }
        transaction.update(ref, { delivery });
        return false;
      }

      const state = payload.delivery.state;
      if (state === "SUCCESS") {
        await events.recordSuccessEvent(change);
        return false;
      }

      if (state === "ERROR") {
        await events.recordErrorEvent(
          change,
          payload,
          payload.delivery.error || ""
        );
        return false;
      }

      if (state === "PROCESSING") {
        await events.recordProcessingEvent(change);
        if (payload.delivery.leaseExpireTime?.toMillis() < Date.now()) {
          const error = "Message processing lease expired.";
          await events.recordErrorEvent(change, payload, error);
          transaction.update(ref, {
            "delivery.state": "ERROR",
            "delivery.error": error,
          });
        }
        return false;
      }

      if (state === "PENDING" || state === "RETRY") {
        const eventFn =
          state === "PENDING"
            ? events.recordPendingEvent
            : events.recordRetryEvent;
        await eventFn(change, payload);
        transaction.update(ref, {
          "delivery.state": "PROCESSING",
          "delivery.leaseExpireTime": Timestamp.fromMillis(Date.now() + 60000),
        });
        return true;
      }

      return false;
    }
  );

  if (shouldAttemptDelivery) {
    await deliver(ref, ctx);
  }
}

export async function handleQueueDoc(
  event: DocumentWriteEvent,
  ctx: HandlerContext
) {
  logs.start(ctx.config);
  const change = event.data;
  if (!change) return null;

  if (!change.before.exists) {
    await events.recordStartEvent(change);
  }

  try {
    await processWrite(change, ctx);
  } catch (err) {
    await events.recordErrorEvent(
      change,
      change.after.data?.(),
      `Unhandled error occurred during processing: ${(err as Error).message}`
    );
    logs.error(err as Error);
    return null;
  }

  await events.recordCompleteEvent(change);
  logs.complete();
  return null;
}
