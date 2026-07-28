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

import { logger } from "firebase-functions";
import type { ResolvedSendEmailConfig } from "./export-config";

export function obfuscatedConfig(config: ResolvedSendEmailConfig) {
  return {
    ...config,
    smtpConnectionUri: config.smtpConnectionUri ? "<omitted>" : undefined,
    smtpPassword: config.smtpPassword ? "<omitted>" : undefined,
    clientId: config.clientId ? "<omitted>" : undefined,
    clientSecret: config.clientSecret ? "<omitted>" : undefined,
    refreshToken: config.refreshToken ? "<omitted>" : undefined,
  };
}

export function init(config: ResolvedSendEmailConfig) {
  logger.log(
    "Initializing extension with configuration",
    obfuscatedConfig(config)
  );
}

export function start(config: ResolvedSendEmailConfig) {
  logger.log(
    "Started execution of extension with configuration",
    obfuscatedConfig(config)
  );
}

export function error(err: Error) {
  logger.log("Unhandled error occurred during processing:", err);
}

export function complete() {
  logger.log("Completed execution of extension");
}

export function attemptingDelivery(ref: { path: string }) {
  logger.log(`Attempting delivery for message: ${ref.path}`);
}

export function delivered(
  ref: { path: string },
  info: {
    messageId: string | null;
    accepted: string[];
    rejected: string[];
    pending: string[];
  }
) {
  logger.log(
    `Delivered message: ${ref.path} successfully. messageId: ${info.messageId} accepted: ${info.accepted.length} rejected: ${info.rejected.length} pending: ${info.pending.length}`
  );
}

export function deliveryError(ref: { path: string }, e: Error) {
  logger.error(`Error when delivering message=${ref.path}: ${e.toString()}`);
}

export function missingUids(uids: string[]) {
  logger.log(
    `The following uids were provided, however a document does not exist or has no 'email' field: ${uids.join(
      ","
    )}`
  );
}

export function noPartialAttachmentSupport() {
  logger.warn("partial attachments are not handled and will be ignored");
}

export function registeredPartial(name: string) {
  logger.log(`registered partial '${name}'`);
}

export function templatesLoaded(names: string[]) {
  logger.log(`loaded templates (${names})`);
}

export function invalidMessage(message: unknown) {
  logger.warn(
    `message '${message}' is not a valid object and no handlebars template has been provided instead - please add as an object or firestore map, otherwise you may experience unexpected results.`
  );
}

export function checkingMissingTemplate(name: string) {
  logger.log(`checking missing template '${name}'`);
}

export function foundMissingTemplate(name: string) {
  logger.log(`template '${name}' has been found`);
}

export function invalidURI() {
  logger.warn(
    "Invalid URI: please reconfigure with a valid SMTP connection URI"
  );
}

export function invalidTlsOptions() {
  logger.warn(
    "Invalid TLS options provided, using default TLS options instead: `{ rejectUnauthorized: false }`"
  );
}

export function info(message: string, details?: Record<string, unknown>) {
  logger.info(message, details);
}
