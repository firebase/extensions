import * as sgMail from "@sendgrid/mail";

export interface SendGridTransportOptions {
  apiKey?: string;
  [key: string]: unknown;
}

export interface Address {
  name?: string;
  address: string;
}

export interface AttachmentEntry {
  content: string | Buffer;
  filename: string;
  contentType: string;
  cid?: string;
}

export interface IcalEvent {
  content: string;
  filename?: string;
}

export interface NormalizedHeaders {
  [header: string]: string;
}

export interface MailSource {
  normalize(cb: (err: Error | null, source: MailSource) => void): void;

  from?: Address | Address[];
  replyTo?: Address | Address[];
  to?: Address | Address[];
  cc?: Address | Address[];
  bcc?: Address | Address[];
  subject?: string;
  text?: string;
  html?: string;
  attachments?: AttachmentEntry[];
  alternatives?: { content: string; contentType: string }[];
  icalEvent?: IcalEvent;
  watchHtml?: string;
  normalizedHeaders?: NormalizedHeaders;
  messageId?: string;

  categories?: string[];
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  mailSettings?: Record<string, unknown>;

  [key: string]: any;
}

export interface SendGridInfo {
  /** The RFC-2822 Message-ID header (what you set or SendGrid generated) */
  messageId: string | null;
  /** SendGrid’s internal queue token (the X-Message-Id HTTP header) */
  queueId: string | null;
  accepted: string[];
  rejected: string[];
  pending: string[];
  /** HTTP status line, e.g. "status=202" */
  response: string;
}

export class SendGridTransport {
  public readonly name = "firebase-extensions-nodemailer-sendgrid";
  public readonly version = "0.0.1";
  private readonly options: SendGridTransportOptions;

  constructor(options: SendGridTransportOptions = {}) {
    this.options = options;
    if (options.apiKey) {
      sgMail.setApiKey(options.apiKey);
    }
  }

  public send(
    mail: MailSource,
    callback: (err: Error | null, info?: SendGridInfo) => void
  ): void {
    mail.normalize((err, source) => {
      if (err) {
        return callback(err);
      }

      const msg: any = {};

      // Map all MailSource properties into the @sendgrid/mail message shape
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
            msg.attachments = atchs.map((entry) => {
              const a: any = {
                content: entry.content,
                filename: entry.filename,
                type: entry.contentType,
                disposition: entry.cid ? "inline" : "attachment",
              };
              if (entry.cid) {
                a.content_id = entry.cid;
              }
              return a;
            });
            break;
          }

          case "alternatives": {
            const alts = source.alternatives || [];
            const fmt = alts.map((alt) => ({
              type: alt.contentType,
              value: alt.content,
            }));
            msg.content = ([] as any[]).concat(msg.content || []).concat(fmt);
            break;
          }

          case "icalEvent": {
            const ev = source.icalEvent!;
            const cal: any = {
              content: ev.content,
              filename: ev.filename || "invite.ics",
              type: "application/ics",
              disposition: "attachment",
            };
            msg.attachments = ([] as any[])
              .concat(msg.attachments || [])
              .concat(cal);
            break;
          }

          case "watchHtml": {
            msg.content = ([] as any[]).concat(msg.content || []).concat({
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
            // Propagate the header-based Message-ID so we can echo it back later
            msg.headers = {
              ...(msg.headers || {}),
              "message-id": source.messageId!,
            };
            break;

          case "categories":
          case "templateId":
          case "dynamicTemplateData":
          case "mailSettings":
            msg[key] = source[key];
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

      // Send via SendGrid's HTTP API
      sgMail
        .send(msg)
        .then(([response]) => {
          // 1) Internal SendGrid queue-ID from HTTP header
          const rawQueue = (response.headers["x-message-id"] ||
            response.headers["X-Message-Id"]) as string | undefined;
          const queueId = rawQueue ? String(rawQueue) : null;

          // 2) Your RFC-2822 Message-ID header
          const headerMsgId = (msg.headers && msg.headers["message-id"]) as
            | string
            | undefined;
          const messageId = headerMsgId || null;

          // 3) Build accepted list from msg.to
          const toList = ([] as any[]).concat(msg.to || []);
          const accepted = toList.map((r) =>
            typeof r === "string" ? r : r.email
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
