/**
 * Delivery module - extracted for testability.
 * Contains the core email delivery logic that can be tested
 * with injected dependencies.
 */

import { DocumentReference } from "firebase-admin/firestore";
import * as nodemailer from "nodemailer";
import * as logs from "./logs";
import config from "./config";
import { preparePayload } from "./prepare-payload";
import { ExtendedSendMailOptions } from "./types";

export interface DeliveryDependencies {
  transport: nodemailer.Transporter;
}

export interface SendMailInfoLike {
  messageId: string | null;
  sendgridQueueId?: string | null;
  accepted: string[];
  rejected: string[];
  pending: string[];
  response: string | null;
}

export interface DeliveryResult {
  success: boolean;
  info?: SendMailInfoLike;
  error?: string;
  skipped?: boolean;
}

/**
 * Prepares and delivers an email from a Firestore document.
 * Returns the result without updating Firestore (caller handles that).
 *
 * @param ref - Firestore document reference
 * @param deps - Dependencies (transport) for sending email
 * @returns DeliveryResult indicating success/failure and info
 */
export async function deliverEmail(
  ref: DocumentReference,
  deps: DeliveryDependencies
): Promise<DeliveryResult> {
  // Fetch the Firestore document
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    return { success: false, skipped: true, error: "Document does not exist" };
  }

  let payload = snapshot.data();

  // Only attempt delivery if the payload is still in the "PROCESSING" state
  if (!payload.delivery || payload.delivery.state !== "PROCESSING") {
    return { success: false, skipped: true, error: "Not in PROCESSING state" };
  }

  logs.attemptingDelivery(ref);

  try {
    // Prepare the payload for delivery (e.g., formatting recipients, templates)
    payload = await preparePayload(payload);

    // Validate that there is at least one recipient (to, cc, or bcc)
    if (!payload.to.length && !payload.cc.length && !payload.bcc.length) {
      throw new Error(
        "Failed to deliver email. Expected at least 1 recipient."
      );
    }

    const mailOptions: ExtendedSendMailOptions = {
      from: payload.from || config.defaultFrom,
      replyTo: payload.replyTo || config.defaultReplyTo,
      to: payload.to,
      cc: payload.cc,
      bcc: payload.bcc,
      subject: payload.message?.subject,
      text: payload.message?.text,
      html: payload.message?.html,
      headers: payload?.headers,
      attachments: payload.message?.attachments,
      categories: payload.categories,
      templateId: payload.sendGrid?.templateId,
      dynamicTemplateData: payload.sendGrid?.dynamicTemplateData,
      mailSettings: payload.sendGrid?.mailSettings,
    };

    logs.info("Sending via transport.sendMail()", { mailOptions });
    const result = (await deps.transport.sendMail(mailOptions)) as any;

    const info: SendMailInfoLike = {
      messageId: result.messageId || null,
      sendgridQueueId: result.queueId || null,
      accepted: result.accepted || [],
      rejected: result.rejected || [],
      pending: result.pending || [],
      response: result.response || null,
    };

    logs.delivered(ref, info);
    return { success: true, info };
  } catch (e) {
    logs.deliveryError(ref, e);
    return { success: false, error: e.toString() };
  }
}
