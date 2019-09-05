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

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

import * as logs from "./logs";
import config from "./config";
import Templates from "./templates";
import { logger } from "handlebars";

admin.initializeApp();
const db = admin.firestore();

const transport = nodemailer.createTransport(config.smtpConnectionUri);
const templates = new Templates(
  admin.firestore().collection(config.templatesCollection)
);

interface QueuePayload {
  delivery?: {
    startTime: FirebaseFirestore.Timestamp;
    endTime: FirebaseFirestore.Timestamp;
    leaseExpireTime: FirebaseFirestore.Timestamp;
    state: "PENDING" | "PROCESSING" | "RETRY" | "SUCCESS" | "ERROR";
    attempts: number;
    error?: string;
    info?: {
      messageId: string;
      accepted: string[];
      rejected: string[];
      pending: string[];
    };
  };
  message?: nodemailer.SendMailOptions;
  template?: {
    name: string;
    data?: { [key: string]: any };
  };
  to: string[];
  toUids?: string[];
  cc: string[];
  ccUids?: string[];
  bcc: string[];
  bccUids?: string[];
  from?: string;
  replyTo?: string;
}

async function processCreate(snap: FirebaseFirestore.DocumentSnapshot) {
  return snap.ref.update({
    delivery: {
      startTime: admin.firestore.FieldValue.serverTimestamp(),
      state: "PENDING",
      attempts: 0,
      error: null,
    },
  });
}

async function preparePayload(payload: QueuePayload): Promise<QueuePayload> {
  if (config.templatesCollection && payload.template) {
    payload.message = Object.assign(
      payload.message || {},
      await templates.render(payload.template.name, payload.template.data)
    );
  }

  if (
    !config.usersCollection ||
    (!payload.toUids && !payload.ccUids && !payload.bccUids)
  ) {
    return payload;
  }

  const toFetch = {};
  []
    .concat(payload.toUids, payload.ccUids, payload.bccUids)
    .forEach((uid) => (toFetch[uid] = null));
  const docs = await db.getAll(
    ...Object.keys(toFetch).map((uid) =>
      db.collection(config.usersCollection).doc(uid)
    ),
    { fieldMask: ["email"] }
  );
  docs.forEach((doc) => {
    if (doc.exists) {
      toFetch[doc.id] = doc.get("email");
    }
  });

  if (payload.toUids) {
    payload.to = payload.toUids.map((uid) => toFetch[uid]);
    delete payload.toUids;
  }
  if (payload.ccUids) {
    payload.cc = payload.ccUids.map((uid) => toFetch[uid]);
    delete payload.ccUids;
  }
  if (payload.bccUids) {
    payload.bcc = payload.bccUids.map((uid) => toFetch[uid]);
    delete payload.bccUids;
  }
  return payload;
}

async function deliver(
  payload: QueuePayload,
  ref: FirebaseFirestore.DocumentReference
): Promise<any> {
  logs.attemptingDelivery(ref);
  const update = {
    "delivery.attempts": admin.firestore.FieldValue.increment(1),
    "delivery.endTime": admin.firestore.FieldValue.serverTimestamp(),
    "delivery.error": null,
    "delivery.leaseExpireTime": null,
  };

  try {
    payload = await preparePayload(payload);
    const result = await transport.sendMail(
      Object.assign(payload.message, {
        from: payload.from || config.defaultFrom,
        replyTo: payload.replyTo || config.defaultReplyTo,
        to: payload.to,
        cc: payload.cc,
        bcc: payload.bcc,
      })
    );
    const info = {
      messageId: result.messageId || null,
      accepted: result.accepted || [],
      rejected: result.rejected || [],
      pending: result.pending || [],
      response: result.response || null,
    };

    update["delivery.state"] = "SUCCESS";
    update["delivery.info"] = info;
    logs.delivered(ref, info);
  } catch (e) {
    update["delivery.state"] = "ERROR";
    update["delivery.error"] = e.toString();
    logs.deliveryError(ref, e);
  }

  return ref.update(update);
}

async function processWrite(change) {
  if (!change.after.exists) {
    return null;
  }

  if (!change.before.exists && change.after.exists) {
    return processCreate(change.after);
  }

  const payload = change.after.data() as QueuePayload;
  if (!payload.delivery) {
    logs.missingDeliveryField(change.after.ref);
    return null;
  }

  switch (payload.delivery.state) {
    case "SUCCESS":
    case "ERROR":
      return null;
    case "PROCESSING":
      if (payload.delivery.leaseExpireTime.toMillis() < Date.now()) {
        return change.after.ref.update({
          "delivery.state": "ERROR",
          error: "Message processing lease expired.",
        });
      }
      return null;
    case "PENDING":
    case "RETRY":
      await change.after.ref.update({
        "delivery.state": "PROCESSING",
        "delivery.leaseExpireTime": admin.firestore.Timestamp.fromMillis(
          Date.now() + 60000
        ),
      });
      return deliver(payload, change.after.ref);
  }
}

export const processQueue = functions.handler.firestore.document.onWrite(async (change) => {
  logs.start();
  try {
    await processWrite(change);
  } catch (err) {
    logs.error(err);
    return null;
  }
  logs.complete();
}
);
