"use strict";
/*
 * Copyright 2019 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
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
const mailchimp = new Mailchimp(config_1.default.mailchimpApiKey);
logs.init();
exports.addUserToList = functions.handler.auth.user.onCreate((user) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    const { email, uid } = user;
    if (!email) {
        logs.userNoEmail();
        return;
    }
    try {
        logs.userAdding(uid, config_1.default.mailchimpAudienceId);
        const results = yield mailchimp.post(`/lists/${config_1.default.mailchimpAudienceId}/members`, {
            email_address: email,
            status: "subscribed",
        });
        logs.userAdded(uid, config_1.default.mailchimpAudienceId, results.id);
        logs.complete();
    }
    catch (err) {
        logs.errorAddUser(err);
    }
}));
exports.removeUserFromList = functions.handler.auth.user.onDelete((user) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
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
