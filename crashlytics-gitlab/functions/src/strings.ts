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

export const gitlabIssueDescription = (
  issueId: string,
  description: string,
  appName: string,
  appId: string,
  platform: string,
  version: string
) =>
  `${description}\n\n- *Issue ID*: ${issueId}\n- *App*: ${appName} (${appId})\n- *Platform*: ${platform}\n- *Version*: ${version}`;

export const newIssueDescription = (appName: string) =>
  `Crashlytics detected a new fatal issue in ${appName}.`;

export const newIssueTitle = (title: string) =>
  `[Crashlytics] [New Fatal Issue] ${title}`;

export const regressionDescription = (appName: string, version: string) =>
  `A fatal issue in ${appName} was closed, but has popped up again in version ${version}.`;

export const regressionTitle = (title: string) =>
  `[Crashlytics] [Regressed Issue] ${title}`;

export const velocityAlertDescription = (title: string, version: string) =>
  `Crashes are spiking for an issue in ${version} in the last hour: ${title}.`;

export const velocityAlertTitle = (title: string) =>
  `[Crashlytics] [Velocity Alert] ${title}`;
