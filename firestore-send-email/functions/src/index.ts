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
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";

import * as logs from "./logs";
import config from "./config";
import Templates from "./templates";
import { Attachment, QueuePayload, SendGridAttachment } from "./types";
import { isSendGrid, setSmtpCredentials } from "./helpers";
import * as events from "./events";
import * as sgMail from "@sendgrid/mail";

logs.init();

let db: admin.firestore.Firestore;
let transport: nodemailer.Transporter;
let templates: Templates;
let initialized = false;

/**
 * Initializes Admin SDK & SMTP connection if not already initialized.
 */
async function initialize() {
  if (initialized === true) return;
  initialized = true;
  admin.initializeApp();
  db = admin.firestore();
  transport = await transportLayer();
  if (config.templatesCollection) {
    templates = new Templates(
      admin.firestore().collection(config.templatesCollection)
    );
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

function getExpireAt(startTime: admin.firestore.Timestamp) {
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

async function preparePayload(payload: QueuePayload): Promise<QueuePayload> {
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

/**
 * If the SMTP provider is SendGrid, we need to check if the payload contains
 * either a text or html content, or if the payload contains a SendGrid Dynamic Template.
 *
 * Throws an error if all of the above are not provided.
 *
 * @param payload the payload from Firestore.
 */

async function sendWithSendGrid(payload: QueuePayload) {
  sgMail.setApiKey(config.smtpPassword);

  const formatEmails = (emails: string[]) => emails.map((email) => ({ email }));

  // Transform attachments to match SendGrid's expected format
  const formatAttachments = (
    attachments: QueuePayload["message"]["attachments"] = []
  ): SendGridAttachment[] => {
    return attachments.map((attachment) => ({
      content: (attachment.content as string | undefined) || "", // Base64-encoded string
      filename: attachment.filename || "attachment",
      type: attachment.contentType,
      disposition: attachment.contentDisposition,
      contentId: attachment.cid,
    }));
  };

  const replyTo = { email: payload.replyTo || config.defaultReplyTo };

  const attachments = payload.message.attachments;

  // Build the message object for SendGrid
  const msg: sgMail.MailDataRequired = {
    to: formatEmails(payload.to),
    cc: formatEmails(payload.cc),
    bcc: formatEmails(payload.bcc),
    from: { email: payload.from || config.defaultFrom },
    replyTo: replyTo.email ? replyTo : undefined,
    subject: payload.message?.subject,
    text:
      typeof payload.message?.text === "string"
        ? payload.message?.text
        : undefined,
    html:
      typeof payload.message?.html === "string"
        ? payload.message?.html
        : undefined,
    categories: payload.categories, // SendGrid-specific field
    headers: payload.headers,
    attachments: formatAttachments(attachments), // Transform attachments to SendGrid format
    mailSettings: payload.sendGrid?.mailSettings || {}, // SendGrid-specific mail settings
  };

  // If a SendGrid template is provided, include templateId and dynamicTemplateData
  if (payload.sendGrid?.templateId) {
    msg.templateId = payload.sendGrid.templateId;
    msg.dynamicTemplateData = payload.sendGrid.dynamicTemplateData || {};
  }

  // Log the final message payload for debugging
  logs.info("SendGrid message payload constructed", { msg });

  // Send the message using SendGrid's API
  return sgMail.send(msg);
}

async function deliver(
  ref: admin.firestore.DocumentReference<QueuePayload>
): Promise<void> {
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
  const update = {
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

    let result;

    // Automatically detect SendGrid
    if (isSendGrid(config)) {
      logs.info("Using SendGrid for email delivery", {
        msg: payload,
      });
      result = await sendWithSendGrid(payload); // Use the SendGrid-specific function
    } else {
      logs.info("Using standard transport for email delivery.", {
        msg: payload,
      });
      // Use the default transport for other SMTP providers
      result = await transport.sendMail({
        ...Object.assign(payload.message ?? {}, {
          from: payload.from || config.defaultFrom,
          replyTo: payload.replyTo || config.defaultReplyTo,
          to: payload.to,
          cc: payload.cc,
          bcc: payload.bcc,
          headers: payload.headers || {},
        }),
      });
    }

    const info = {
      messageId: result.messageId || null,
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
  return admin.firestore().runTransaction((transaction) => {
    // We could check state here is still PROCESSING, but we don't
    // since the email sending will have been attempted regardless of what the
    // delivery state was at that point, so we just update the state to reflect
    // the result of the last attempt so as to not potentially cause duplicate sends.
    transaction.update(ref, update);
    return Promise.resolve();
  });
}

async function processWrite(
  change: functions.Change<admin.firestore.DocumentSnapshot<QueuePayload>>
): Promise<void> {
  const ref = change.after.ref;

  // A quick check to avoid doing unnecessary transaction work.
  // If the record state is SUCCESS or ERROR we don't need to do anything
  // transactionally here since these are the 'final' delivery states.
  // Note: we still check these again inside the transaction in case the state has
  // changed while the transaction was inflight.
  if (change.after.exists) {
    const payloadAfter = change.after.data();
    // The email has already been delivered, so we don't need to do anything.
    if (
      payloadAfter &&
      payloadAfter.delivery &&
      payloadAfter.delivery.state === "SUCCESS"
    ) {
      return;
    }

    // The email has previously failed to be delivered, so we can't do anything.
    if (
      payloadAfter &&
      payloadAfter.delivery &&
      payloadAfter.delivery.state === "ERROR"
    ) {
      return;
    }
  }

  const shouldAttemptDelivery = await admin
    .firestore()
    .runTransaction<boolean>(async (transaction) => {
      const snapshot = await transaction.get(ref);
      // Record no longer exists, so no need to attempt delivery.
      if (!snapshot.exists) {
        return false;
      }

      const payload = snapshot.data();

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

        const delivery = {
          startTime: Timestamp.fromDate(new Date()),
          state: "PENDING",
          attempts: 0,
          error: null,
        };

        if (config.TTLExpireType && config.TTLExpireType !== "never") {
          delivery["expireAt"] = getExpireAt(startTime);
        }

        transaction.update(ref, {
          //@ts-ignore
          delivery,
        });
        // We've updated the payload, so we need to attempt delivery, but we
        // don't want to do it in this transaction. Since the transaction will
        // update the record again the cloud function will be triggered again
        // and delivery will be attempted at that point.
        return false;
      }

      // The email has already been delivered, so we don't need to do anything.
      if (payload.delivery.state === "SUCCESS") {
        await events.recordSuccessEvent(change);
        return false;
      }

      // The email has previously failed to be delivered, so we can't do anything.
      if (payload.delivery.state === "ERROR") {
        await events.recordErrorEvent(change, payload, payload.delivery.error);
        return false;
      }

      if (payload.delivery.state === "PROCESSING") {
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

      if (payload.delivery.state === "PENDING") {
        await events.recordPendingEvent(change, payload);

        // We can attempt to deliver the email in these states, so we set the state to PROCESSING
        // and set a lease time to prevent delivery from being attempted forever.
        transaction.update(ref, {
          "delivery.state": "PROCESSING",
          "delivery.leaseExpireTime": Timestamp.fromMillis(Date.now() + 60000),
        });
        return true;
      }

      if (payload.delivery.state === "RETRY") {
        await events.recordRetryEvent(change, payload);

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
    });

  if (shouldAttemptDelivery) {
    await deliver(ref);
  }
}

export const processQueue = functions.firestore
  .document(config.mailCollection)
  .onWrite(
    async (
      change: functions.Change<admin.firestore.DocumentSnapshot<QueuePayload>>
    ) => {
      await initialize();
      logs.start();

      if (!change.before.exists) {
        await events.recordStartEvent(change);
      }

      try {
        await processWrite(change);
      } catch (err) {
        await events.recordErrorEvent(
          change,
          change.after.data(),
          `Unhandled error occurred during processing: ${err.message}"`
        );
        logs.error(err);
        return null;
      }

      /** record complete event */
      await events.recordCompleteEvent(change);

      logs.complete();
    }
  );
