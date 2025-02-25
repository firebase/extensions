import * as nodemailer from "nodemailer";
import * as admin from "firebase-admin";
import * as Handlebars from "handlebars";

type HandlebarsTemplateDelegate = Handlebars.TemplateDelegate;
export interface Config {
  location: string;
  mailCollection: string;
  smtpConnectionUri?: string;
  smtpPassword?: string;
  defaultFrom: string;
  defaultReplyTo?: string;
  usersCollection?: string;
  templatesCollection?: string;
  testing?: boolean;
  TTLExpireType?: string;
  TTLExpireValue?: number;
  tls?: string;
  host?: Hosts | string;
  port?: number;
  secure?: boolean;
  user?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  authenticationType: AuthenticatonType;
}
export interface Attachment {
  filename?: string;
  content?: string;
  path?: string;
  encoding?: string;
  raw?: string;
  href?: string;
  httpHeaders?: any;
  contentDisposition?: string;
  contentType?: string;
  headers?: any;
  cid?: string;
}

export interface TemplateGroup {
  subject?: HandlebarsTemplateDelegate;
  html?: HandlebarsTemplateDelegate;
  text?: HandlebarsTemplateDelegate;
  amp?: HandlebarsTemplateDelegate;
  attachments?: HandlebarsTemplateDelegate;
}

export interface TemplateData {
  name: string;
  subject?: string;
  html?: string;
  text?: string;
  amp?: string;
  partial?: boolean;
  attachments?: Attachment[];
}

export interface QueuePayload {
  delivery?: {
    startTime: admin.firestore.Timestamp;
    endTime: admin.firestore.Timestamp;
    leaseExpireTime: admin.firestore.Timestamp;
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
  sendGrid?: {
    templateId?: string;
    dynamicTemplateData?: { [key: string]: any };
    mailSettings?: { [key: string]: any };
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
  attachments: Attachment[];
  categories?: string[];
}

// Define the expected format for SendGrid attachments
export type SendGridAttachment = {
  content: string; // Base64-encoded string
  filename: string;
  type?: string;
  disposition?: string;
  contentId?: string;
};

export enum AuthenticatonType {
  OAuth2 = "OAuth2",
  UsernamePassword = "UsernamePassword",
  ApiKey = "ApiKey",
}

export enum Hosts {
  Gmail = "smtp.gmail.com",
  SendGrid = "smtp.sendgrid.net",
  Outlook = "smtp-mail.outlook.com",
  Hotmail = "smtp.live.com",
}
