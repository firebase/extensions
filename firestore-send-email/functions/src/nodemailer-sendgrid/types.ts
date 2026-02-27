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
  customArgs?: Record<string, string>;

  [key: string]: unknown;
}

export interface SendGridInfo {
  /** The RFC-2822 Message-ID header (what you set or SendGrid generated) */
  messageId: string | null;
  /** SendGrid's internal queue token (the X-Message-Id HTTP header) */
  queueId: string | null;
  accepted: string[];
  rejected: string[];
  pending: string[];
  /** HTTP status line, e.g. "status=202" */
  response: string;
}

export interface SendGridAttachment {
  content: string;
  filename: string;
  type: string;
  disposition: string;
  content_id?: string;
}

export interface SendGridContent {
  type: string;
  value: string;
}

export interface SendGridMessage {
  subject?: string;
  text?: string;
  html?: string;
  from?: { name?: string; email: string };
  replyTo?: { name?: string; email: string };
  to?: Array<{ name?: string; email: string }>;
  cc?: Array<{ name?: string; email: string }>;
  bcc?: Array<{ name?: string; email: string }>;
  attachments?: SendGridAttachment[];
  content?: SendGridContent[];
  headers?: Record<string, string>;
  categories?: string[];
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  mailSettings?: Record<string, unknown>;
  customArgs?: Record<string, string>;
  [key: string]: unknown;
}
