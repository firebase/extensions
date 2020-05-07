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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const functions = require("firebase-functions");
// @ts-ignore incorrect typescript typings
const Mailchimp = require("mailchimp-api-v3");
const config_1 = require("./config");
const logs = require("./logs");
logs.init();
let mailchimp;
try {
    mailchimp = new Mailchimp(config_1.default.mailchimpApiKey);
}
catch (err) {
    logs.initError(err);
}
exports.addUserToList = functions.handler.auth.user.onCreate((user) => __awaiter(void 0, void 0, void 0, function* () {
    logs.start();
    if (!mailchimp) {
        logs.mailchimpNotInitialized();
        return;
    }
    const { email, uid } = user;
    if (!email) {
        logs.userNoEmail();
        return;
    }
    try {
        logs.userAdding(uid, config_1.default.mailchimpAudienceId);
        const results = yield mailchimp.post(`/lists/${config_1.default.mailchimpAudienceId}/members`, {
            email_address: email,
            status: config_1.default.mailchimpContactStatus,
        });
        logs.userAdded(uid, config_1.default.mailchimpAudienceId, results.id, config_1.default.mailchimpContactStatus);
        logs.complete();
    }
    catch (err) {
        logs.errorAddUser(err);
    }
}));
exports.removeUserFromList = functions.handler.auth.user.onDelete((user) => __awaiter(void 0, void 0, void 0, function* () {
    logs.start();
    if (!mailchimp) {
        logs.mailchimpNotInitialized();
        return;
    }
    const { email, uid } = user;
    if (!email) {
        logs.userNoEmail();
        return;
    }
    try {
        const hashed = crypto
            .createHash("md5")
            .update(email)
            .digest("hex");
        logs.userRemoving(uid, hashed, config_1.default.mailchimpAudienceId);
        yield mailchimp.delete(`/lists/${config_1.default.mailchimpAudienceId}/members/${hashed}`);
        logs.userRemoved(uid, hashed, config_1.default.mailchimpAudienceId);
        logs.complete();
    }
    catch (err) {
        logs.errorRemoveUser(err);
    }
}));
