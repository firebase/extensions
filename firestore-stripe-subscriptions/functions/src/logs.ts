/*
 * Copyright 2020 Stripe, Inc.
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

export const creatingCustomer = (uid: string) => {
  console.log(`⚙️ Creating customer object for [${uid}].`);
};

export const customerCreationError = (error: Error, uid: string) => {
  console.error(
    `❗️[Error]: Failed to create customer for [${uid}]:`,
    error.message
  );
};

export const customerDeletionError = (error: Error, uid: string) => {
  console.error(
    `❗️[Error]: Failed to delete customer for [${uid}]:`,
    error.message
  );
};

export function customerCreated(id: string, livemode: boolean) {
  console.log(
    `✅Created a new customer: https://dashboard.stripe.com${
      livemode ? '' : '/test'
    }/customers/${id}.`
  );
}

export function creatingCheckoutSession(docId: string) {
  console.log(`⚙️ Creating checkout session for doc [${docId}].`);
}

export function checkoutSessionCreated(docId: string) {
  console.log(`✅Checkout session created for doc [${docId}].`);
}

export function checkoutSessionCreationError(docId: string, error: Error) {
  console.error(
    `❗️[Error]: Checkout session creation failed for doc [${docId}]:`,
    error.message
  );
}

export function createdBillingPortalLink(uid: string) {
  console.log(`✅Created billing portal link for user [${uid}].`);
}

export function billingPortalLinkCreationError(uid: string, error: Error) {
  console.error(
    `❗️[Error]: Customer portal link creation failed for user [${uid}]:`,
    error.message
  );
}

export function firestoreDocCreated(collection: string, docId: string) {
  console.log(
    `🔥📄 Added doc [${docId}] to collection [${collection}] in Firestore.`
  );
}

export function userCustomClaimSet(uid: string, claim: object) {
  console.log(
    `🚦 Set custom claim for user [${uid}]: ${JSON.stringify(claim)}.`
  );
}

export function badWebhookSecret(error: Error) {
  console.error(
    '❗️[Error]: Webhook signature verification failed. Is your Stripe webhook secret parameter configured correctly?',
    error.message
  );
}

export function startWebhookEventProcessing(id: string, type: string) {
  console.log(`⚙️ Handling Stripe event [${id}] of type [${type}].`);
}

export function webhookHandlerSucceeded(id: string, type: string) {
  console.log(`✅Successfully handled Stripe event [${id}] of type [${type}].`);
}

export function webhookHandlerError(error: Error, id: string, type: string) {
  console.error(
    `❗️[Error]: Webhook handler for  Stripe event [${id}] of type [${type}] failed:`,
    error.message
  );
}
