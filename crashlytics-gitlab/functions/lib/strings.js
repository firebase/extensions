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
exports.gitlabIssueDescription = (issueId, description, appName, appId, platform, version) => `${description}\n\n- *Issue ID*: ${issueId}\n- *App*: ${appName} (${appId})\n- *Platform*: ${platform}\n- *Version*: ${version}`;
exports.newIssueDescription = (appName) => `Crashlytics detected a new fatal issue in ${appName}.`;
exports.newIssueTitle = (title) => `[Crashlytics] [New Fatal Issue] ${title}`;
exports.regressionDescription = (appName, version) => `A fatal issue in ${appName} was closed, but has popped up again in version ${version}.`;
exports.regressionTitle = (title) => `[Crashlytics] [Regressed Issue] ${title}`;
exports.velocityAlertDescription = (title, version) => `Crashes are spiking for an issue in ${version} in the last hour: ${title}.`;
exports.velocityAlertTitle = (title) => `[Crashlytics] [Velocity Alert] ${title}`;
