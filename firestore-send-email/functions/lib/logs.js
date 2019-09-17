"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const safeConfig = Object.assign({}, config_1.default, {
    smtpConnectionUri: "<omitted>",
});
function init() {
    console.log("Initializing extension with configuration", safeConfig);
}
exports.init = init;
function start() {
    console.log("Started execution of extension with configuration", safeConfig);
}
exports.start = start;
function error(err) {
    console.log("Unhandled error occurred during processing:", err);
}
exports.error = error;
function complete() {
    console.log("Completed execution of extension");
}
exports.complete = complete;
function attemptingDelivery(ref) {
    console.log(`Attempting delivery for message: ${ref.path}`);
}
exports.attemptingDelivery = attemptingDelivery;
function delivered(ref, info) {
    console.log(`Delivered message: ${ref.path} successfully. messageId: ${info.messageId} accepted: ${info.accepted.length} rejected: ${info.rejected.length} pending: ${info.pending.length}`);
}
exports.delivered = delivered;
function deliveryError(ref, e) {
    console.error(`Error when delivering message=${ref.path}: ${e.toString()}`);
}
exports.deliveryError = deliveryError;
function missingDeliveryField(ref) {
    console.error(`message=${ref.path} is missing 'delivery' field`);
}
exports.missingDeliveryField = missingDeliveryField;
