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
import * as twilio from "twilio";

import * as logs from "./logs";
import config from "./config";
import Templates from "./templates";

logs.init();

let db: admin.firestore.Firestore;
let transport: twilio.Twilio;
let templates: Templates;
let initialized = false;

/**
 * Initializes Admin SDK & SMTP connection if not already initialized.
 */
function initialize() {
  if (initialized === true) return;
  initialized = true;
  admin.initializeApp();
  db = admin.firestore();
  transport = twilio(config.twilioAccountSid, config.twilioAuthToken);
  if (config.templatesCollection) {
    templates = new Templates(
      admin.firestore().collection(config.templatesCollection)
    );
  }
}

interface QueuePayload {
  delivery?: {
    startTime: FirebaseFirestore.Timestamp;
    endTime: FirebaseFirestore.Timestamp;
    leaseExpireTime: FirebaseFirestore.Timestamp;
    state:
      | "PENDING"
      | "PROCESSING"
      | "RETRY"
      | "QUEUED"
      | "ACCEPTED"
      | "SENDING"
      | "SENT"
      | "DELIVERED"
      | "UNDELIVERED"
      | "FAILED"
      | "ERROR";
    attempts: number;
    error?: string;
    info?: {
      messageId: string;
      accepted: string[];
      rejected: string[];
      pending: string[];
    };
  };
  // See https://www.twilio.com/docs/libraries/reference/twilio-node/3.37.1/Twilio.Api.V2010.AccountContext.MessageList.html#create
  message?: {
    body: string;
    mediaUrl?: string | string[];
    validityPeriod?: boolean;
  };
  template?: {
    name: string;
    data?: { [key: string]: any };
  };
  to: string;
  toUid?: string;
  from?: string;
}

function validateFieldArray(field: string, array?: string[]) {
  if (!Array.isArray(array)) {
    throw new Error(`Invalid field "${field}". Expected an array of strings.`);
  }

  if (array.find((item) => typeof item !== "string")) {
    throw new Error(`Invalid field "${field}". Expected an array of strings.`);
  }
}

async function processCreate(snap: FirebaseFirestore.DocumentSnapshot) {
  // Wrapping in transaction to allow for automatic retries (#48)
  return admin.firestore().runTransaction((transaction) => {
    transaction.update(snap.ref, {
      delivery: {
        startTime: admin.firestore.FieldValue.serverTimestamp(),
        state: "PENDING",
        attempts: 0,
        error: null,
      },
    });
    return Promise.resolve();
  });
}

async function preparePayload(payload: QueuePayload): Promise<QueuePayload> {
  const { template } = payload;

  if (templates && template) {
    if (!template.name) {
      throw new Error(`Template object is missing a 'name' parameter.`);
    }

    payload.message = Object.assign(
      payload.message || {},
      await templates.render(template.name, template.data)
    );
  }

  if (!payload.toUid) {
    return payload;
  }

  if (!config.usersCollection) {
    throw new Error("Must specify a users collection to send using uid.");
  }

  payload.to = (
    await db.getAll(db.collection(config.usersCollection).doc(payload.toUid), {
      fieldMask: ["tel"],
    })
  )[0].get("tel");

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

    if (!payload.to) {
      throw new Error("Failed to deliver email. Missing 'to'.");
    }

    const callbackUrl = `https://${config.location}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/ext-${process.env.EXT_INSTANCE_ID}-processStatusCallback?msg_id=${ref.id}`;
    console.log(callbackUrl);

    const result = await transport.messages.create(
      Object.assign(
        {
          from: config.defaultFrom,
          smartEncoded: true,
          statusCallback: callbackUrl,
        },
        payload.message,
        { to: payload.to }
      )
    );
    const info = result.toJSON();

    update["delivery.state"] = result.status.toUpperCase();
    update["delivery.info"] = info;
    logs.delivered(ref, info);
  } catch (e) {
    update["delivery.state"] = "ERROR";
    update["delivery.error"] = e.toString();
    logs.deliveryError(ref, e);
  }

  // Wrapping in transaction to allow for automatic retries (#48)
  return admin.firestore().runTransaction((transaction) => {
    transaction.update(ref, update);
    return Promise.resolve();
  });
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
    case "SENT":
    case "DELIVERED":
    case "UNDELIVERED":
    case "FAILED":
    case "ERROR":
      return null;
    case "PROCESSING":
    case "QUEUED":
    case "ACCEPTED":
    case "SENDING":
      if (payload.delivery.leaseExpireTime.toMillis() < Date.now()) {
        // Wrapping in transaction to allow for automatic retries (#48)
        return admin.firestore().runTransaction((transaction) => {
          transaction.update(change.after.ref, {
            "delivery.state": "ERROR",
            error: "Message processing lease expired.",
          });
          return Promise.resolve();
        });
      }
      return null;
    case "PENDING":
    case "RETRY":
      // Wrapping in transaction to allow for automatic retries (#48)
      await admin.firestore().runTransaction((transaction) => {
        transaction.update(change.after.ref, {
          "delivery.state": "PROCESSING",
          "delivery.leaseExpireTime": admin.firestore.Timestamp.fromMillis(
            Date.now() + 60000
          ),
        });
        return Promise.resolve();
      });
      return deliver(payload, change.after.ref);
  }
}

export const processQueue = functions.handler.firestore.document.onWrite(
  async (change) => {
    initialize();
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

function isTerminal(state): boolean {
  return ["SENT", "DELIVERED", "FAILED", "UNDELIVERED"].includes(
    state.toUpperCase()
  );
}

export const processStatusCallback = functions.handler.https.onRequest(
  async (req, res) => {
    admin.initializeApp();
    db = admin.firestore();
    if (req.body.MessageStatus) {
      const newState = req.body.MessageStatus.toUpperCase();
      await admin
        .firestore()
        .collection(config.smsCollection)
        .doc(req.query.msg_id)
        .update({
          "delivery.endTime": isTerminal(newState)
            ? admin.firestore.FieldValue.serverTimestamp()
            : null,
          "delivery.state": newState,
          "delivery.error": req.body.ErrorCode || null,
        });
    }
    console.log(req.query, JSON.stringify(req.body, null, 2));
    res.send("OK");
  }
);
