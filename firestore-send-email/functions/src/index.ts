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
} from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

import * as logs from "./logs";
import config from "./config";
import Templates from "./templates";
import { Delivery, QueuePayload } from "./types";
import { isSendGrid, setSmtpCredentials } from "./transport";
import * as events from "./events";
import { SendGridTransport } from "./nodemailer-sendgrid";
import { setDependencies } from "./prepare-payload";
import { deliverEmail } from "./delivery";
import { getExpireAt } from "./ttl";

logs.init();

let db: Firestore;
let transport: nodemailer.Transporter;
let templates: Templates;
let initialized = false;

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

  // Set dependencies for preparePayload
  setDependencies(db, templates);

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

async function deliver(ref: DocumentReference): Promise<void> {
  const result = await deliverEmail(ref, { transport });

  // Skip Firestore update if document was skipped (doesn't exist or not in PROCESSING state)
  if (result.skipped) {
    return;
  }

  // Prepare the Firestore document for delivery updates
  const update: Record<string, any> = {
    "delivery.attempts": FieldValue.increment(1),
    "delivery.endTime": FieldValue.serverTimestamp(),
    "delivery.error": null,
    "delivery.leaseExpireTime": null,
    "delivery.state": result.success ? "SUCCESS" : "ERROR",
  };

  if (result.success && result.info) {
    update["delivery.info"] = result.info;
  } else if (!result.success && result.error) {
    update["delivery.error"] = result.error;
  }

  // Update the Firestore document transactionally to allow retries (#48)
  // We could check state here is still PROCESSING, but we don't
  // since the email sending will have been attempted regardless of what the
  // delivery state was at that point, so we just update the state to reflect
  // the result of the last attempt so as to not potentially cause duplicate sends.
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
  // If the record state is SUCCESS or ERROR we don't need to do anything
  // transactionally here since these are the 'final' delivery states.
  // Note: we still check these again inside the transaction in case the state has
  // changed while the transaction was inflight.
  if (change.after.exists) {
    const state = (change.after.data() as QueuePayload)?.delivery?.state;
    if (state === "SUCCESS" || state === "ERROR") {
      return;
    }
  }

  const shouldAttemptDelivery = await db.runTransaction<boolean>(
    async (transaction) => {
      const snapshot = await transaction.get(ref);
      // Record no longer exists, so no need to attempt delivery.
      if (!snapshot.exists) {
        return false;
      }

      const payload = snapshot.data() as QueuePayload;

      // We expect the payload to contain a message object describing the email
      // to be sent, or a template, or a SendGrid template.
      // If it doesn't and is not a template, we can't do anything.
      if (
        typeof payload.message !== "object" &&
        !payload.template &&
        typeof payload.sendGrid !== "object"
      ) {
        logs.invalidMessage(payload.message);
        return false;
      }

      // The record has most likely just been created by a client, so we need to
      // initialize the delivery state.
      if (!payload.delivery) {
        const startTime = Timestamp.fromDate(new Date());
        const delivery: Partial<Delivery> = {
          startTime: startTime,
          state: "PENDING",
          attempts: 0,
          error: null,
        };
        if (config.TTLExpireType && config.TTLExpireType !== "never") {
          delivery.expireAt = getExpireAt(startTime);
        }
        transaction.update(ref, { delivery });
        // We've updated the payload, so we need to attempt delivery, but we
        // don't want to do it in this transaction. Since the transaction will
        // update the record again the cloud function will be triggered again
        // and delivery will be attempted at that point.
        return false;
      }

      const state = payload.delivery.state;
      // The email has already been delivered, so we don't need to do anything.
      if (state === "SUCCESS") {
        await events.recordSuccessEvent(change);
        return false;
      }

      // The email has previously failed to be delivered, so we can't do anything.
      if (state === "ERROR") {
        await events.recordErrorEvent(change, payload, payload.delivery.error);
        return false;
      }

      if (state === "PROCESSING") {
        await events.recordProcessingEvent(change);
        if (payload.delivery.leaseExpireTime.toMillis() < Date.now()) {
          const error = "Message processing lease expired.";

          /** Send error event */
          await events.recordErrorEvent(change, payload, error);

          // The lease has expired, so we should not attempt to deliver the email again,
          // but we set the state to ERROR so clients can see that the email failed.
          transaction.update(ref, {
            "delivery.state": "ERROR",
            // Keeping error to avoid any breaking changes in the next minor update.
            // Error to be removed for the next major release.
            "delivery.error": "Message processing lease expired.",
          });
        }
        // Already being processed, so we don't need to do anything.
        return false;
      }

      if (state === "PENDING" || state === "RETRY") {
        const eventFn =
          state === "PENDING"
            ? events.recordPendingEvent
            : events.recordRetryEvent;
        await eventFn(change, payload);

        // We can attempt to deliver the email in these states, so we set the state to PROCESSING
        // and set a lease time to prevent delivery from being attempted forever.
        transaction.update(ref, {
          "delivery.state": "PROCESSING",
          "delivery.leaseExpireTime": Timestamp.fromMillis(Date.now() + 60000),
        });
        return true;
      }

      // We don't know what the state is, so we can't do anything. This should never happen.
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
