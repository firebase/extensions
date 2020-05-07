"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
exports.obfuscatedConfig = Object.assign(Object.assign({}, config_1.default), { mailchimpApiKey: "<omitted>" });
exports.complete = () => {
    console.log("Completed execution of extension");
};
exports.errorAddUser = (err) => {
    console.error("Error when adding user to Mailchimp audience", err);
};
exports.errorRemoveUser = (err) => {
    console.error("Error when removing user from Mailchimp audience", err);
};
exports.init = () => {
    console.log("Initializing extension with configuration", exports.obfuscatedConfig);
};
exports.initError = (err) => {
    console.error("Error when initializing extension", err);
};
exports.mailchimpNotInitialized = () => {
    console.error("Mailchimp was not initialized correctly, check for errors in the logs");
};
exports.start = () => {
    console.log("Started execution of extension with configuration", exports.obfuscatedConfig);
};
exports.userAdded = (userId, audienceId, mailchimpId, status) => {
    console.log(`Added user: ${userId} with status '${status}' to Mailchimp audience: ${audienceId} with Mailchimp ID: ${mailchimpId}`);
};
exports.userAdding = (userId, audienceId) => {
    console.log(`Adding user: ${userId} to Mailchimp audience: ${audienceId}`);
};
exports.userNoEmail = () => {
    console.log("User does not have an email");
};
exports.userRemoved = (userId, hashedEmail, audienceId) => {
    console.log(`Removed user: ${userId} with hashed email: ${hashedEmail} from Mailchimp audience: ${audienceId}`);
};
exports.userRemoving = (userId, hashedEmail, audienceId) => {
    console.log(`Removing user: ${userId} with hashed email: ${hashedEmail} from Mailchimp audience: ${audienceId}`);
};
