"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookHandlerError = exports.webhookHandlerSucceeded = exports.startWebhookEventProcessing = exports.badWebhookSecret = exports.userCustomClaimSet = exports.firestoreDocCreated = exports.billingPortalLinkCreationError = exports.createdBillingPortalLink = exports.checkoutSessionCreationError = exports.checkoutSessionCreated = exports.creatingCheckoutSession = exports.customerCreated = exports.customerDeletionError = exports.customerCreationError = exports.creatingCustomer = void 0;
exports.creatingCustomer = (uid) => {
    console.log(`⚙️ Creating customer object for [${uid}].`);
};
exports.customerCreationError = (error, uid) => {
    console.error(`❗️[Error]: Failed to create customer for [${uid}]:`, error.message);
};
exports.customerDeletionError = (error, uid) => {
    console.error(`❗️[Error]: Failed to delete customer for [${uid}]:`, error.message);
};
function customerCreated(id, livemode) {
    console.log(`✅Created a new customer: https://dashboard.stripe.com${livemode ? '' : '/test'}/customers/${id}.`);
}
exports.customerCreated = customerCreated;
function creatingCheckoutSession(docId) {
    console.log(`⚙️ Creating checkout session for doc [${docId}].`);
}
exports.creatingCheckoutSession = creatingCheckoutSession;
function checkoutSessionCreated(docId) {
    console.log(`✅Checkout session created for doc [${docId}].`);
}
exports.checkoutSessionCreated = checkoutSessionCreated;
function checkoutSessionCreationError(docId, error) {
    console.error(`❗️[Error]: Checkout session creation failed for doc [${docId}]:`, error.message);
}
exports.checkoutSessionCreationError = checkoutSessionCreationError;
function createdBillingPortalLink(uid) {
    console.log(`✅Created billing portal link for user [${uid}].`);
}
exports.createdBillingPortalLink = createdBillingPortalLink;
function billingPortalLinkCreationError(uid, error) {
    console.error(`❗️[Error]: Customer portal link creation failed for user [${uid}]:`, error.message);
}
exports.billingPortalLinkCreationError = billingPortalLinkCreationError;
function firestoreDocCreated(collection, docId) {
    console.log(`🔥📄 Added doc [${docId}] to collection [${collection}] in Firestore.`);
}
exports.firestoreDocCreated = firestoreDocCreated;
function userCustomClaimSet(uid, claim) {
    console.log(`🚦 Set custom claim for user [${uid}]: ${JSON.stringify(claim)}.`);
}
exports.userCustomClaimSet = userCustomClaimSet;
function badWebhookSecret(error) {
    console.error('❗️[Error]: Webhook signature verification failed. Is your Stripe webhook secret parameter configured correctly?', error.message);
}
exports.badWebhookSecret = badWebhookSecret;
function startWebhookEventProcessing(id, type) {
    console.log(`⚙️ Handling Stripe event [${id}] of type [${type}].`);
}
exports.startWebhookEventProcessing = startWebhookEventProcessing;
function webhookHandlerSucceeded(id, type) {
    console.log(`✅Successfully handled Stripe event [${id}] of type [${type}].`);
}
exports.webhookHandlerSucceeded = webhookHandlerSucceeded;
function webhookHandlerError(error, id, type) {
    console.error(`❗️[Error]: Webhook handler for  Stripe event [${id}] of type [${type}] failed:`, error.message);
}
exports.webhookHandlerError = webhookHandlerError;
//# sourceMappingURL=logs.js.map