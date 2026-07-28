/*
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

import type { Timestamp } from "firebase-admin/firestore";
import type * as Handlebars from "handlebars";
import type * as nodemailer from "nodemailer";

export type HandlebarsTemplateDelegate = Handlebars.TemplateDelegate;

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

export interface Attachment {
  filename?: string;
  content?: string;
  path?: string;
  encoding?: string;
  raw?: string;
  href?: string;
  httpHeaders?: Record<string, string>;
  contentDisposition?: string;
  contentType?: string;
  headers?: Record<string, string>;
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

export interface Delivery {
  startTime: Timestamp;
  endTime?: Timestamp;
  leaseExpireTime?: Timestamp;
  state: "PENDING" | "PROCESSING" | "RETRY" | "SUCCESS" | "ERROR";
  attempts: number;
  error?: string | null;
  expireAt?: Timestamp;
  info?: {
    messageId: string | null;
    sendgridQueueId?: string | null;
    accepted: string[];
    rejected: string[];
    pending: string[];
    response?: string | null;
  };
}

export interface QueuePayload {
  delivery?: Delivery;
  message?: nodemailer.SendMailOptions;
  template?: {
    name: string;
    data?: Record<string, unknown>;
  };
  sendGrid?: {
    templateId?: string;
    dynamicTemplateData?: Record<string, unknown>;
    mailSettings?: Record<string, unknown>;
    customArgs?: Record<string, string>;
    ipPoolName?: string;
  };
  to?: string[] | string;
  toUids?: string[];
  cc?: string[] | string;
  ccUids?: string[];
  bcc?: string[] | string;
  bccUids?: string[];
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: Attachment[];
  categories?: string[];
}

export interface ExtendedSendMailOptions extends nodemailer.SendMailOptions {
  categories?: string[];
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  mailSettings?: Record<string, unknown>;
  customArgs?: Record<string, string>;
  ipPoolName?: string;
}
