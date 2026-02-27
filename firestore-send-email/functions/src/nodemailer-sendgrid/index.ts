import * as sgMail from "@sendgrid/mail";
import {
  SendGridTransportOptions,
  Address,
  MailSource,
  SendGridInfo,
  SendGridAttachment,
  SendGridContent,
  SendGridMessage,
} from "./types";

/**
 * A Nodemailer transport implementation for SendGrid.
 * This class handles the conversion of Nodemailer mail objects to SendGrid's format
 * and sends emails using the SendGrid API.
 */
export class SendGridTransport {
  /** The name of the transport */
  public readonly name = "firebase-extensions-nodemailer-sendgrid";
  /** The version of the transport */
  public readonly version = "0.0.1";
  /** The SendGrid transport options */
  private readonly options: SendGridTransportOptions;

  /**
   * Creates a new SendGridTransport instance.
   * @param options - Configuration options for the SendGrid transport
   * @param options.apiKey - SendGrid API key for authentication
   */
  constructor(options: SendGridTransportOptions = {}) {
    this.options = options;
    if (options.apiKey) {
      sgMail.setApiKey(options.apiKey);
    }
  }

  /**
   * Sends an email using SendGrid.
   * @param mail - The mail object containing email details (from, to, subject, etc.)
   * @param callback - Callback function to handle the result of the send operation
   * @param callback.err - Error object if the send operation failed
   * @param callback.info - Information about the sent email if successful
   */
  public send(
    mail: MailSource,
    callback: (err: Error | null, info?: SendGridInfo) => void
  ): void {
    mail.normalize((err, source) => {
      if (err) {
        return callback(err);
      }

      const msg: SendGridMessage = {};

      for (const key of Object.keys(source)) {
        switch (key) {
          case "subject":
          case "text":
          case "html":
            msg[key] = source[key];
            break;

          case "from":
          case "replyTo": {
            const list = ([] as Address[]).concat(source[key] || []);
            const e = list[0];
            if (e) {
              msg[key] = { name: e.name, email: e.address };
            }
            break;
          }

          case "to":
          case "cc":
          case "bcc": {
            const list = ([] as Address[]).concat(source[key] || []);
            msg[key] = list.map((e) => ({ name: e.name, email: e.address }));
            break;
          }

          case "attachments": {
            const atchs = source.attachments || [];
            msg.attachments = atchs.map((entry) => ({
              content: entry.content.toString(),
              filename: entry.filename,
              type: entry.contentType,
              disposition: entry.cid ? "inline" : "attachment",
              ...(entry.cid ? { content_id: entry.cid } : {}),
            }));
            break;
          }

          case "alternatives": {
            const alts = source.alternatives || [];
            const fmt = alts.map((alt) => ({
              type: alt.contentType,
              value: alt.content,
            }));
            msg.content = ([] as SendGridContent[])
              .concat(msg.content || [])
              .concat(fmt);
            break;
          }

          case "icalEvent": {
            const ev = source.icalEvent!;
            const cal: SendGridAttachment = {
              content: ev.content,
              filename: ev.filename || "invite.ics",
              type: "application/ics",
              disposition: "attachment",
            };
            msg.attachments = ([] as SendGridAttachment[])
              .concat(msg.attachments || [])
              .concat(cal);
            break;
          }

          case "watchHtml": {
            msg.content = ([] as SendGridContent[])
              .concat(msg.content || [])
              .concat({
                type: "text/watch-html",
                value: source.watchHtml!,
              });
            break;
          }

          case "normalizedHeaders":
            msg.headers = {
              ...(msg.headers || {}),
              ...source.normalizedHeaders,
            };
            break;

          case "messageId":
            msg.headers = {
              ...(msg.headers || {}),
              "message-id": source.messageId!,
            };
            break;

          case "categories":
            msg.categories = source.categories;
            break;
          case "templateId":
            msg.templateId = source.templateId;
            break;
          case "dynamicTemplateData":
            msg.dynamicTemplateData = source.dynamicTemplateData;
            break;
          case "mailSettings":
            msg.mailSettings = source.mailSettings;
            break;
          case "customArgs":
            msg.customArgs = source.customArgs;
            break;

          default:
            msg[key] = source[key];
        }
      }

      // If we built a msg.content array, ensure text/html are injected
      if (Array.isArray(msg.content) && msg.content.length) {
        if (msg.text) {
          msg.content.unshift({ type: "text/plain", value: msg.text });
          delete msg.text;
        }
        if (msg.html) {
          msg.content.unshift({ type: "text/html", value: msg.html });
          delete msg.html;
        }
      }

      sgMail
        .send(msg as sgMail.MailDataRequired)
        .then(([response]) => {
          // Internal SendGrid queue-ID from HTTP header
          const rawQueueId = (response.headers["x-message-id"] ||
            response.headers["X-Message-Id"]) as string | undefined;
          const queueId = rawQueueId ? String(rawQueueId) : null;

          // RFC-2822 Message-ID header
          const headerMsgId = (msg.headers && msg.headers["message-id"]) as
            | string
            | undefined;
          const messageId = headerMsgId || null;

          // Include all recipients (to, cc, bcc) in accepted array
          const toList = ([] as Array<{ email: string }>).concat(msg.to || []);
          const ccList = ([] as Array<{ email: string }>).concat(msg.cc || []);
          const bccList = ([] as Array<{ email: string }>).concat(
            msg.bcc || []
          );
          const accepted = Array.from(
            new Set(
              [...toList, ...ccList, ...bccList].map((r) =>
                (typeof r === "string" ? r : r.email).toLowerCase()
              )
            )
          );

          const info: SendGridInfo = {
            messageId,
            queueId,
            accepted,
            rejected: [],
            pending: [],
            response: `status=${response.statusCode}`,
          };

          callback(null, info);
        })
        .catch((sendErr: Error) => callback(sendErr));
    });
  }
}
