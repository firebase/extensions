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

export default {
  acceptUrlTemplate: process.env.ACCEPT_URL_TEMPLATE,
  appName: process.env.APP_NAME,
  invitationsCollection: process.env.METADATA_FIRESTORE_COLLECTION,
  location: process.env.LOCATION,
  sendgridEmailAlias: process.env.SENDGRID_EMAIL_ALIAS,
  sendgridApiKey: process.env.SENDGRID_API_KEY,
  targetReceiverFields: process.env.TARGET_RECEIVER_FIELDS,
  targetSenderFields: process.env.TARGET_SENDER_FIELDS,
};
