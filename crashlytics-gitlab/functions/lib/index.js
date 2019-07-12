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
const gitlab_1 = require("gitlab");
const config_1 = require("./config");
const logs = require("./logs");
const strings = require("./strings");
const api = new gitlab_1.Gitlab({
    host: config_1.default.gitlabUrl,
    token: config_1.default.gitlabAccessToken,
});
logs.init();
exports.crashlyticsgitlabnew = functions.handler.crashlytics.issue.onNew((issue) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    try {
        const { appInfo, issueTitle } = issue;
        const title = strings.newIssueTitle(issueTitle);
        const description = strings.newIssueDescription(appInfo.appName);
        yield createGitlabIssue(issue, title, description);
    }
    catch (err) {
        logs.error(err);
    }
}));
exports.crashlyticsgitlabregression = functions.handler.crashlytics.issue.onRegressed((issue) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    try {
        const { appInfo, issueTitle } = issue;
        const { appName, latestAppVersion } = appInfo;
        const title = strings.regressionTitle(issueTitle);
        const description = strings.regressionDescription(appName, latestAppVersion);
        yield createGitlabIssue(issue, title, description);
    }
    catch (err) {
        logs.error(err);
    }
}));
exports.crashlyticsgitlabvelocityalert = functions.handler.crashlytics.issue.onVelocityAlert((issue) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    try {
        const { appInfo, issueTitle } = issue;
        const title = strings.velocityAlertTitle(issueTitle);
        const description = strings.velocityAlertDescription(issueTitle, appInfo.latestAppVersion);
        yield createGitlabIssue(issue, title, description);
    }
    catch (err) {
        logs.error(err);
    }
}));
const createGitlabIssue = (issue, title, description) => __awaiter(this, void 0, void 0, function* () {
    const { appInfo, createTime, issueId } = issue;
    const { appId, appName, appPlatform, latestAppVersion } = appInfo;
    logs.gitlabIssueCreating(issueId);
    const issueDescription = strings.gitlabIssueDescription(issueId, description, appName, appId, appPlatform, latestAppVersion);
    yield api.Issues.create(config_1.default.gitlabProjectId, {
        description: issueDescription,
        title,
        createdAt: createTime,
    });
    logs.gitlabIssueCreated(issueId);
});
