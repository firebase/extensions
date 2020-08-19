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

logs.init();

let db;
let transport;
let templates;
let initialized = false;

/**
 * Initializes Admin SDK & SMTP connection if not already initialized.
 */
function initialize() {
  if (initialized === true) return;
  initialized = true;
  admin.initializeApp();
  db = admin.firestore();
  transport = nodemailer.createTransport(config.smtpConnectionUri);
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
  headers?: any;
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

  const toFetch = {};
  uids.forEach((uid) => (toFetch[uid] = null));

  const documents = await db.getAll(
    ...Object.keys(toFetch).map((uid) =>
      db.collection(config.usersCollection).doc(uid)
    ),
    {
      fieldMask: ["email"],
    }
  );

  const missingUids = [];

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

    if (!payload.to.length && !payload.cc.length && !payload.bcc.length) {
      throw new Error(
        "Failed to deliver email. Expected at least 1 recipient."
      );
    }

    const result = await transport.sendMail(
      Object.assign(payload.message, {
        from: payload.from || config.defaultFrom,
        replyTo: payload.replyTo || config.defaultReplyTo,
        to: payload.to,
        cc: payload.cc,
        bcc: payload.bcc,
        headers: payload.headers || {},
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
    case "SUCCESS":
    case "ERROR":
      return null;
    case "PROCESSING":
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
