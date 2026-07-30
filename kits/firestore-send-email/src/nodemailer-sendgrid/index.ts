/**
 * Copyright 2026 Google LLC
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

import * as sgMail from "@sendgrid/mail";
import type {
  Address,
  MailSource,
  SendGridAttachment,
  SendGridContent,
  SendGridInfo,
  SendGridMessage,
  SendGridTransportOptions,
} from "./types";

export class SendGridTransport {
  public readonly name = "firebase-extensions-nodemailer-sendgrid";
  public readonly version = "0.0.1";

  constructor(options: SendGridTransportOptions = {}) {
    if (options.apiKey) {
      sgMail.setApiKey(options.apiKey);
    }
  }

  public send(
    mail: MailSource,
    callback: (err: Error | null, info?: SendGridInfo) => void
  ): void {
    mail.normalize((err, source) => {
      if (err) return callback(err);

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
            const entry = list[0];
            if (entry) {
              msg[key] = { name: entry.name, email: entry.address };
            }
            break;
          }
          case "to":
          case "cc":
          case "bcc": {
            const list = ([] as Address[]).concat(source[key] || []);
            msg[key] = list.map((entry) => ({
              name: entry.name,
              email: entry.address,
            }));
            break;
          }
          case "attachments": {
            const attachments = source.attachments || [];
            msg.attachments = attachments.map((entry) => ({
              content: entry.content.toString(),
              filename: entry.filename,
              type: entry.contentType,
              disposition: entry.cid ? "inline" : "attachment",
              ...(entry.cid ? { content_id: entry.cid } : {}),
            }));
            break;
          }
          case "alternatives": {
            const alternatives = source.alternatives || [];
            const formatted = alternatives.map((alt) => ({
              type: alt.contentType,
              value: alt.content,
            }));
            msg.content = ([] as SendGridContent[])
              .concat(msg.content || [])
              .concat(formatted);
            break;
          }
          case "icalEvent": {
            const event = source.icalEvent;
            if (!event) {
              break;
            }
            const calendar: SendGridAttachment = {
              content: event.content,
              filename: event.filename || "invite.ics",
              type: "application/ics",
              disposition: "attachment",
            };
            msg.attachments = ([] as SendGridAttachment[])
              .concat(msg.attachments || [])
              .concat(calendar);
            break;
          }
          case "watchHtml":
            if (!source.watchHtml) {
              break;
            }
            msg.content = ([] as SendGridContent[])
              .concat(msg.content || [])
              .concat({ type: "text/watch-html", value: source.watchHtml });
            break;
          case "normalizedHeaders":
            msg.headers = {
              ...(msg.headers || {}),
              ...source.normalizedHeaders,
            };
            break;
          case "messageId":
            if (!source.messageId) {
              break;
            }
            msg.headers = {
              ...(msg.headers || {}),
              "message-id": source.messageId,
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
          case "ipPoolName":
            msg.ipPoolName = source.ipPoolName;
            break;
          default:
            (msg as any)[key] = source[key];
        }
      }

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
          const rawQueueId = (response.headers["x-message-id"] ||
            response.headers["X-Message-Id"]) as string | undefined;
          const queueId = rawQueueId ? String(rawQueueId) : null;
          const headerMessageId = msg.headers?.["message-id"] as
            | string
            | undefined;
          const accepted = Array.from(
            new Set(
              [
                ...([] as Array<{ email: string }>).concat(msg.to || []),
                ...([] as Array<{ email: string }>).concat(msg.cc || []),
                ...([] as Array<{ email: string }>).concat(msg.bcc || []),
              ].map((recipient) =>
                (typeof recipient === "string"
                  ? recipient
                  : recipient.email
                ).toLowerCase()
              )
            )
          );

          callback(null, {
            messageId: headerMessageId || null,
            queueId,
            accepted,
            rejected: [],
            pending: [],
            response: `status=${response.statusCode}`,
          });
        })
        .catch((sendErr: Error) => callback(sendErr));
    });
  }
}
