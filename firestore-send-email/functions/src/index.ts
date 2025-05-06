/**
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

import { initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  Timestamp,
  Firestore,
  DocumentSnapshot,
  DocumentReference,
  getFirestore,
  DocumentData,
} from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

import * as logs from "./logs";
import config from "./config";
import Templates from "./templates";
import { QueuePayload } from "./types";
import { isSendGrid, setSmtpCredentials } from "./helpers";
import * as events from "./events";
import { SendGridTransport } from "./nodemailer-sendgrid";

logs.init();

let db: Firestore;
let transport: nodemailer.Transporter;
let templates: Templates;
let initialized = false;

interface SendMailInfoLike {
  messageId: string | null;
  sendgridQueueId?: string | null;
  accepted: string[];
  rejected: string[];
  pending: string[];
  response: string | null;
}

/**
 * Initializes Admin SDK & SMTP connection if not already initialized.
 */
async function initialize() {
  if (initialized === true) return;
  initialized = true;
  initializeApp();
  db = getFirestore(config.database);
  transport = await transportLayer();
  if (config.templatesCollection) {
    templates = new Templates(db.collection(config.templatesCollection));
  }

  /** setup events */
  events.setupEventChannel();
}

async function transportLayer() {
  if (config.testing) {
    return nodemailer.createTransport({
      host: "127.0.0.1",
      port: 8132,
      secure: false,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  if (isSendGrid(config)) {
    // use our custom transport
    return nodemailer.createTransport(
      new SendGridTransport({ apiKey: config.smtpPassword })
    );
  }
  // fallback to any other SMTP provider
  return setSmtpCredentials(config);
}

function validateFieldArray(field: string, array?: string[]) {
  if (!Array.isArray(array)) {
    throw new Error(`Invalid field "${field}". Expected an array of strings.`);
  }

  if (array.find((item) => typeof item !== "string")) {
    throw new Error(`Invalid field "${field}". Expected an array of strings.`);
  }
}

function getExpireAt(startTime: Timestamp) {
  const now = startTime.toDate();
  const value = config.TTLExpireValue;
  switch (config.TTLExpireType) {
    case "hour":
      now.setHours(now.getHours() + value);
      break;
    case "day":
      now.setDate(now.getDate() + value);
      break;
    case "week":
      now.setDate(now.getDate() + value);
      break;
    case "month":
      now.setMonth(now.getMonth() + value);
      break;
    case "year":
      now.setFullYear(now.getFullYear() + value);
      break;
  }
  return Timestamp.fromDate(now);
}

async function preparePayload(payload: DocumentData): Promise<DocumentData> {
  const { template } = payload;

  if (templates && template) {
    if (!template.name) {
      throw new Error(`Template object is missing a 'name' parameter.`);
    }

    const templateRender = await templates.render(template.name, template.data);

    const mergeMessage = payload.message || {};

    const attachments = templateRender.attachments
      ? templateRender.attachments
      : mergeMessage.attachments;

    payload.message = Object.assign(mergeMessage, templateRender, {
      attachments: attachments || [],
    });
  }

  let to: string[] = [];
  let cc: string[] = [];
  let bcc: string[] = [];

  if (typeof payload.to === "string") {
    to = [payload.to];
  } else if (payload.to) {
    validateFieldArray("to", payload.to);
    to = to.concat(payload.to);
  }

  if (typeof payload.cc === "string") {
    cc = [payload.cc];
  } else if (payload.cc) {
    validateFieldArray("cc", payload.cc);
    cc = cc.concat(payload.cc);
  }

  if (typeof payload.bcc === "string") {
    bcc = [payload.bcc];
  } else if (payload.bcc) {
    validateFieldArray("bcc", payload.bcc);
    bcc = bcc.concat(payload.bcc);
  }

  if (!payload.toUids && !payload.ccUids && !payload.bccUids) {
    payload.to = to;
    payload.cc = cc;
    payload.bcc = bcc;

    return payload;
  }

  if (!config.usersCollection) {
    throw new Error("Must specify a users collection to send using uids.");
  }

  let uids: string[] = [];

  if (payload.toUids) {
    validateFieldArray("toUids", payload.toUids);
    uids = uids.concat(payload.toUids);
  }

  if (payload.ccUids) {
    validateFieldArray("ccUids", payload.ccUids);
    uids = uids.concat(payload.ccUids);
  }

  if (payload.bccUids) {
    validateFieldArray("bccUids", payload.bccUids);
    uids = uids.concat(payload.bccUids);
  }

  const toFetch: Record<string, string | null> = {};
  uids.forEach((uid) => (toFetch[uid] = null));

  const documents = await db.getAll(
    ...Object.keys(toFetch).map((uid) =>
      db.collection(config.usersCollection).doc(uid)
    ),
    {
      fieldMask: ["email"],
    }
  );

  const missingUids: string[] = [];

  documents.forEach((documentSnapshot) => {
    if (documentSnapshot.exists) {
      const email = documentSnapshot.get("email");

      if (email) {
        toFetch[documentSnapshot.id] = email;
      } else {
        missingUids.push(documentSnapshot.id);
      }
    } else {
      missingUids.push(documentSnapshot.id);
    }
  });

  logs.missingUids(missingUids);

  if (payload.toUids) {
    payload.toUids.forEach((uid) => {
      const email = toFetch[uid];
      if (email) {
        to.push(email);
      }
    });
  }

  payload.to = to;

  if (payload.ccUids) {
    payload.ccUids.forEach((uid) => {
      const email = toFetch[uid];
      if (email) {
        cc.push(email);
      }
    });
  }

  payload.cc = cc;

  if (payload.bccUids) {
    payload.bccUids.forEach((uid) => {
      const email = toFetch[uid];
      if (email) {
        bcc.push(email);
      }
    });
  }

  payload.bcc = bcc;

  return payload;
}

async function deliver(ref: DocumentReference): Promise<void> {
  // Fetch the Firestore document
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return;
  }

  let payload = snapshot.data();

  // Only attempt delivery if the payload is still in the "PROCESSING" state
  if (!payload.delivery || payload.delivery.state !== "PROCESSING") {
    return;
  }

  logs.attemptingDelivery(ref);

  // Prepare the Firestore document for delivery updates
  const update: Record<string, any> = {
    "delivery.attempts": FieldValue.increment(1),
    "delivery.endTime": FieldValue.serverTimestamp(),
    "delivery.error": null,
    "delivery.leaseExpireTime": null,
  };

  try {
    // Prepare the payload for delivery (e.g., formatting recipients, templates)
    payload = await preparePayload(payload);

    // Validate that there is at least one recipient (to, cc, or bcc)
    if (!payload.to.length && !payload.cc.length && !payload.bcc.length) {
      throw new Error(
        "Failed to deliver email. Expected at least 1 recipient."
      );
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: payload.from || config.defaultFrom,
      replyTo: payload.replyTo || config.defaultReplyTo,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.message?.subject,
      text: payload.message?.text,
      html: payload.message?.html,
      attachments: payload.message?.attachments,
      // @ts-ignore - TODO: fix types here
      categories: payload.categories,
      templateId: payload.sendGrid?.templateId,
      dynamicTemplateData: payload.sendGrid?.dynamicTemplateData,
      mailSettings: payload.sendGrid?.mailSettings,
    };

    logs.info("Sending via transport.sendMail()", { mailOptions });
    const result = (await transport.sendMail(mailOptions)) as any;

    const info: SendMailInfoLike = {
      messageId: result.messageId || null,
      sendgridQueueId: result.queueId || null,
      accepted: result.accepted || [],
      rejected: result.rejected || [],
      pending: result.pending || [],
      response: result.response || null,
    };

    // Update Firestore document to indicate success
    update["delivery.state"] = "SUCCESS";
    update["delivery.info"] = info;

    logs.delivered(ref, info);
  } catch (e) {
    // Update Firestore document to indicate failure
    update["delivery.state"] = "ERROR";
    update["delivery.error"] = e.toString();
    logs.deliveryError(ref, e);
  }

  // Update the Firestore document transactionally to allow retries (#48)
  return db.runTransaction((transaction) => {
    transaction.update(ref, update);
    return Promise.resolve();
  });
}

async function processWrite(
  change: functions.Change<DocumentSnapshot>
): Promise<void> {
  const ref = change.after.ref;

  // A quick check to avoid doing unnecessary transaction work.
  if (change.after.exists) {
    const payloadAfter = change.after.data() as QueuePayload;
    if (
      payloadAfter &&
      payloadAfter.delivery &&
      (payloadAfter.delivery.state === "SUCCESS" ||
        payloadAfter.delivery.state === "ERROR")
    ) {
      return;
    }
  }

  const shouldAttemptDelivery = await db.runTransaction<boolean>(
    async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) {
        return false;
      }

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
        const delivery: any = {
          startTime: startTime,
          state: "PENDING",
          attempts: 0,
          error: null,
        };
        if (config.TTLExpireType && config.TTLExpireType !== "never") {
          delivery.expireAt = getExpireAt(startTime);
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
        await events.recordErrorEvent(change, payload, payload.delivery.error);
        return false;
      }
      if (state === "PROCESSING") {
        await events.recordProcessingEvent(change);
        if (payload.delivery.leaseExpireTime.toMillis() < Date.now()) {
          const error = "Message processing lease expired.";
          await events.recordErrorEvent(change, payload, error);
          transaction.update(ref, {
            "delivery.state": "ERROR",
            "delivery.error": "Message processing lease expired.",
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
    await deliver(ref);
  }
}

export const processQueue = onDocumentWritten(
  `${config.mailCollection}/{documentId}`,
  async (event) => {
    await initialize();
    logs.start();

    const change = event.data;

    if (!change.before.exists) {
      await events.recordStartEvent(change);
    }

    try {
      await processWrite(change);
    } catch (err: any) {
      await events.recordErrorEvent(
        change,
        change.after.data(),
        `Unhandled error occurred during processing: ${err.message}`
      );
      logs.error(err);
      return null;
    }

    await events.recordCompleteEvent(change);
    logs.complete();
  }
);
