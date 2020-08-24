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
exports.userRemoving = exports.userRemoved = exports.userNoEmail = exports.userAdding = exports.userAdded = exports.start = exports.mailchimpNotInitialized = exports.initError = exports.init = exports.errorRemoveUser = exports.errorAddUser = exports.complete = exports.obfuscatedConfig = void 0;
const firebase_functions_1 = require("firebase-functions");
const config_1 = require("./config");
exports.obfuscatedConfig = {
    ...config_1.default,
    mailchimpApiKey: "<omitted>",
};
exports.complete = () => {
    firebase_functions_1.logger.log("Completed execution of extension");
};
exports.errorAddUser = (err) => {
    firebase_functions_1.logger.error("Error when adding user to Mailchimp audience", err);
};
exports.errorRemoveUser = (err) => {
    firebase_functions_1.logger.error("Error when removing user from Mailchimp audience", err);
};
exports.init = () => {
    firebase_functions_1.logger.log("Initializing extension with configuration", exports.obfuscatedConfig);
};
exports.initError = (err) => {
    firebase_functions_1.logger.error("Error when initializing extension", err);
};
exports.mailchimpNotInitialized = () => {
    firebase_functions_1.logger.error("Mailchimp was not initialized correctly, check for errors in the logs");
};
exports.start = () => {
    firebase_functions_1.logger.log("Started execution of extension with configuration", exports.obfuscatedConfig);
};
exports.userAdded = (userId, audienceId, mailchimpId, status) => {
    firebase_functions_1.logger.log(`Added user: ${userId} with status '${status}' to Mailchimp audience: ${audienceId} with Mailchimp ID: ${mailchimpId}`);
};
exports.userAdding = (userId, audienceId) => {
    firebase_functions_1.logger.log(`Adding user: ${userId} to Mailchimp audience: ${audienceId}`);
};
exports.userNoEmail = () => {
    firebase_functions_1.logger.log("User does not have an email");
};
exports.userRemoved = (userId, hashedEmail, audienceId) => {
    firebase_functions_1.logger.log(`Removed user: ${userId} with hashed email: ${hashedEmail} from Mailchimp audience: ${audienceId}`);
};
exports.userRemoving = (userId, hashedEmail, audienceId) => {
    firebase_functions_1.logger.log(`Removing user: ${userId} with hashed email: ${hashedEmail} from Mailchimp audience: ${audienceId}`);
};
