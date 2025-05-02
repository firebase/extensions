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
  subject?: string;
  text?: string;
  html?: string;
  from?: Address | Address[];
  replyTo?: Address | Address[];
  to?: Address | Address[];
  cc?: Address | Address[];
  bcc?: Address | Address[];
  attachments?: AttachmentEntry[];
  alternatives?: { content: string; contentType: string }[];
  icalEvent?: IcalEvent;
  watchHtml?: string;
  normalizedHeaders?: NormalizedHeaders;
  messageId?: string;
  [key: string]: any;
  normalize(cb: (err: Error | null, source: MailSource) => void): void;
}

export class SendGridTransport {
  public readonly name: string;
  public readonly version: string;
  private readonly options: SendGridTransportOptions;

  constructor(options: SendGridTransportOptions = {}) {
    this.options = options;
    this.name = "firebase-extensions-nodemailer-sendgrid";
    this.version = "0.0.1";
    if (options.apiKey) {
      sgMail.setApiKey(options.apiKey);
    }
  }

  public send(
    mail: MailSource,
    callback: (err: Error | null, result?: unknown) => void
  ): void {
    mail.normalize((err, source) => {
      if (err) {
        return callback(err);
      }

      const msg: any = {};

      for (const key of Object.keys(source || {})) {
        switch (key) {
          case "subject":
          case "text":
          case "html":
            msg[key] = source[key];
            break;

          case "from":
          case "replyTo":
            msg[key] = []
              .concat(source[key] ?? [])
              .map((entry: Address) => ({
                name: entry.name,
                email: entry.address,
              }))
              .shift();
            break;

          case "to":
          case "cc":
          case "bcc":
            msg[key] = [].concat(source[key] ?? []).map((entry: Address) => ({
              name: entry.name,
              email: entry.address,
            }));
            break;

          case "attachments": {
            const attachments = (source.attachments ?? []).map((entry) => {
              const attachment: any = {
                content: entry.content,
                filename: entry.filename,
                type: entry.contentType,
                disposition: "attachment",
              };
              if (entry.cid) {
                attachment.content_id = entry.cid;
                attachment.disposition = "inline";
              }
              return attachment;
            });
            msg.attachments = []
              .concat(msg.attachments ?? [])
              .concat(attachments);
            break;
          }

          case "alternatives": {
            const alternatives = (source.alternatives ?? []).map((entry) => ({
              content: entry.content,
              type: entry.contentType,
            }));
            msg.content = [].concat(msg.content ?? []).concat(alternatives);
            break;
          }

          case "icalEvent": {
            const ev = source.icalEvent!;
            const attachment = {
              content: ev.content,
              filename: ev.filename ?? "invite.ics",
              type: "application/ics",
              disposition: "attachment",
            };
            msg.attachments = []
              .concat(msg.attachments ?? [])
              .concat(attachment);
            break;
          }

          case "watchHtml": {
            const alternative = {
              content: source.watchHtml!,
              type: "text/watch-html",
            };
            msg.content = [].concat(msg.content ?? []).concat(alternative);
            break;
          }

          case "normalizedHeaders":
            msg.headers = {
              ...(msg.headers ?? {}),
              ...source.normalizedHeaders,
            };
            break;

          case "messageId":
            msg.headers = {
              ...(msg.headers ?? {}),
              "message-id": source.messageId,
            };
            break;

          default:
            msg[key] = source[key];
        }
      }

      // If we've built a `content` array, merge in text/html
      if (Array.isArray(msg.content) && msg.content.length) {
        if (msg.text) {
          msg.content.unshift({ type: "text/plain", content: msg.text });
          delete msg.text;
        }
        if (msg.html) {
          msg.content.unshift({ type: "text/html", content: msg.html });
          delete msg.html;
        }
      }

      sgMail
        .send(msg)
        .then((response) => {
          callback(null, response);
        })
        .catch((err: Error) => {
          callback(err);
        });
    });
  }
}
