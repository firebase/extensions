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
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const rp = require("request-promise-native");
const config_1 = require("./config");
const logs = require("./logs");
// Initialize the Firebase Admin SDK
admin.initializeApp();
logs.init();
exports.showConfigDiff = functions.handler.remoteConfig.onUpdate((versionMetadata) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    try {
        logs.accessTokenLoading();
        const accessToken = yield getAccessToken();
        logs.accessTokenLoaded();
        logs.recentTemplatesLoading(versionMetadata.versionNumber);
        const { current, previous } = yield getRecentTemplatesAtVersion(accessToken, versionMetadata.versionNumber);
        logs.recentTemplatesLoaded(versionMetadata.versionNumber);
        logs.diffGenerating();
        const diff = getDiffOfTemplateParameters(previous, current);
        logs.slackMessageGenerating();
        const message = buildDiffMessageFormattedForSlack(current.version, diff);
        logs.slackMessageSending();
        yield postToSlack(message);
        logs.slackMessageSent();
        logs.complete();
    }
    catch (err) {
        logs.error(err);
    }
}));
const buildDiffMessageFormattedForSlack = (version, diff) => {
    const versionNumber = `Remote config changed to version *${version.versionNumber}*. `;
    const updatedBy = "Updated by `" + version.updateUser.email + "` ";
    const updateDetail = "from `" + version.updateOrigin + "` as `" + version.updateType + "`.";
    const message = [versionNumber, updatedBy, updateDetail];
    if (diff.added.length > 0) {
        message.push(buildDiffSection(`Added`, diff.added));
    }
    if (diff.removed.length > 0) {
        message.push(buildDiffSection(`Removed`, diff.removed));
    }
    if (diff.updated.length > 0) {
        message.push(buildDiffSection(`Updated`, diff.updated));
    }
    return message.join(`\n`);
};
const buildDiffSection = (heading, list) => {
    const params = list.length == 1 ? `parameter` : `parameters`;
    const header = `*${heading} ${list.length} ${params}:*`;
    const items = list.map((v) => JSON.stringify(v, null, 3));
    return [header, "```", items, "```"].join("\n");
};
const parameterExists = (parameters, name) => name in parameters;
const getDiffOfTemplateParameters = (previous, current) => {
    const before = Object.keys(previous.parameters);
    const after = Object.keys(current.parameters);
    const added = after
        .filter((name) => !parameterExists(previous.parameters, name))
        .map((name) => ({ name, param: current.parameters[name] }));
    const removed = before
        .filter((name) => !parameterExists(current.parameters, name))
        .map((name) => ({ name, param: previous.parameters[name] }));
    const updated = after
        .filter((name) => parameterExists(previous.parameters, name))
        .map((name) => getTemplateDifferences(name, previous.parameters[name], current.parameters[name]))
        .filter((v) => !!v);
    return { added, removed, updated };
};
const noDifferencesFound = (diff) => !diff.description && !diff.value;
const getValueDifference = (prev, curr) => {
    const isDifferent = prev !== curr;
    return isDifferent
        ? {
            from: prev,
            to: curr,
        }
        : undefined;
};
const getTemplateDifferences = (name, prev, curr) => {
    const diff = {
        description: getValueDifference(prev.description, curr.description),
        name,
        value: getValueDifference(prev.defaultValue.value, curr.defaultValue.value),
    };
    if (noDifferencesFound(diff)) {
        return undefined;
    }
    return diff;
};
const postToSlack = (text) => __awaiter(this, void 0, void 0, function* () {
    const options = {
        method: "POST",
        uri: config_1.default.slackWebhookUrl,
        json: true,
        body: {
            text,
            mrkdwn: true,
        },
    };
    const response = yield rp(options);
    return response;
});
const getAccessToken = () => __awaiter(this, void 0, void 0, function* () {
    const accessToken = yield admin.credential
        .applicationDefault()
        .getAccessToken();
    return accessToken.access_token;
});
const getRecentTemplatesAtVersion = (accessToken, version) => __awaiter(this, void 0, void 0, function* () {
    const [current, previous] = yield Promise.all([
        getTemplate(accessToken, version),
        getTemplate(accessToken, version - 1),
    ]);
    return { current, previous };
});
const getTemplate = (accessToken, version) => __awaiter(this, void 0, void 0, function* () {
    const uri = `https://firebaseremoteconfig.googleapis.com/v1/projects/${process.env.PROJECT_ID}/remoteConfig`;
    const options = {
        uri,
        qs: {
            versionNumber: version,
        },
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        json: true,
    };
    const template = yield rp(options);
    return template;
});
