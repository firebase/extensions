import config from "./config";

const safeConfig = Object.assign({}, config, {smtpConnectionUri: '<omitted>'});

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

export function init() {
  console.log('Initializing extension with configuration', safeConfig);
}

export function start() {
  console.log('Started extension execution with configuration', safeConfig);
}

export function error(err: Error) {
  console.log('Unhandled error occurred during processing:', err);
}

export function complete() {
  console.log('Completed extension execution');
}

export function attemptingDelivery(ref: FirebaseFirestore.DocumentReference) {
  console.log(`Attempting delivery for message: ${ref.path}`);
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
  console.log(
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
  console.error(`error delivering message=${ref.path}: ${e.toString()}`);
}

export function missingDeliveryField(ref: FirebaseFirestore.DocumentReference) {
  console.error(`message=${ref.path} is missing 'delivery' field`);
}
