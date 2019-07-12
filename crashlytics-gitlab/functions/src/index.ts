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

import * as functions from "firebase-functions";
import { Gitlab } from "gitlab";

import config from "./config";
import * as logs from "./logs";
import * as strings from "./strings";

const api = new Gitlab({
  host: config.gitlabUrl,
  token: config.gitlabAccessToken,
});

logs.init();

export const crashlyticsgitlabnew = functions.handler.crashlytics.issue.onNew(
  async (issue): Promise<void> => {
    logs.start();
    try {
      const { appInfo, issueTitle } = issue;
      const title = strings.newIssueTitle(issueTitle);
      const description = strings.newIssueDescription(appInfo.appName);
      await createGitlabIssue(issue, title, description);
    } catch (err) {
      logs.error(err);
    }
  }
);

export const crashlyticsgitlabregression = functions.handler.crashlytics.issue.onRegressed(
  async (issue): Promise<void> => {
    logs.start();
    try {
      const { appInfo, issueTitle } = issue;
      const { appName, latestAppVersion } = appInfo;
      const title = strings.regressionTitle(issueTitle);
      const description = strings.regressionDescription(
        appName,
        latestAppVersion
      );
      await createGitlabIssue(issue, title, description);
    } catch (err) {
      logs.error(err);
    }
  }
);

export const crashlyticsgitlabvelocityalert = functions.handler.crashlytics.issue.onVelocityAlert(
  async (issue): Promise<void> => {
    logs.start();
    try {
      const { appInfo, issueTitle } = issue;
      const title = strings.velocityAlertTitle(issueTitle);
      const description = strings.velocityAlertDescription(
        issueTitle,
        appInfo.latestAppVersion
      );
      await createGitlabIssue(issue, title, description);
    } catch (err) {
      logs.error(err);
    }
  }
);

const createGitlabIssue = async (
  issue: functions.crashlytics.Issue,
  title: string,
  description: string
) => {
  const { appInfo, createTime, issueId } = issue;
  const { appId, appName, appPlatform, latestAppVersion } = appInfo;

  logs.gitlabIssueCreating(issueId);
  const issueDescription = strings.gitlabIssueDescription(
    issueId,
    description,
    appName,
    appId,
    appPlatform,
    latestAppVersion
  );
  await api.Issues.create(config.gitlabProjectId, {
    description: issueDescription,
    title,
    createdAt: createTime,
  });
  logs.gitlabIssueCreated(issueId);
};
