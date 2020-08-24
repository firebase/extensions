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

import config from "./config";
import { logger } from "firebase-functions";

export const obfuscatedConfig = Object.assign({}, config, {
  smtpConnectionUri: "<omitted>",
});

export function init() {
  logger.log("Initializing extension with configuration", obfuscatedConfig);
}

export function start() {
  logger.log(
    "Started execution of extension with configuration",
    obfuscatedConfig
  );
}

export function error(err: Error) {
  logger.log("Unhandled error occurred during processing:", err);
}

export function complete() {
  logger.log("Completed execution of extension");
}

export function attemptingDelivery(ref: FirebaseFirestore.DocumentReference) {
  logger.log(`Attempting delivery for message: ${ref.path}`);
}

export function delivered(
  ref: FirebaseFirestore.DocumentReference,
  info: {
    messageId: string;
    accepted: string[];
    rejected: string[];
    pending: string[];
  }
) {
  logger.log(
    `Delivered message: ${ref.path} successfully. messageId: ${
      info.messageId
    } accepted: ${info.accepted.length} rejected: ${
      info.rejected.length
    } pending: ${info.pending.length}`
  );
}

export function deliveryError(
  ref: FirebaseFirestore.DocumentReference,
  e: Error
) {
  logger.error(`Error when delivering message=${ref.path}: ${e.toString()}`);
}

export function missingDeliveryField(ref: FirebaseFirestore.DocumentReference) {
  logger.error(`message=${ref.path} is missing 'delivery' field`);
}

export function missingUids(uids: string[]) {
  logger.log(
    `The following uids were provided, however a document does not exist or has no 'email' field: ${uids.join(
      ","
    )}`
  );
}
