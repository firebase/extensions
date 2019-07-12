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

import config from "./config";

export const accessTokenLoaded = () => {
  console.log("Loaded access token");
};

export const accessTokenLoading = () => {
  console.log("Loading access token");
};

export const complete = () => {
  console.log("Completed mod execution");
};

export const diffGenerating = () => {
  console.log(`Generating diff between versions`);
};

export const error = (err: Error) => {
  console.error("Error when sending remote config to slack", err);
};

export const init = () => {
  console.log("Initializing mod with configuration", config);
};

export const recentTemplatesLoaded = (version: number) => {
  console.log(`Loaded recent templates at version: ${version}`);
};

export const recentTemplatesLoading = (version: number) => {
  console.log(`Loading recent templates at version: ${version}`);
};

export const slackMessageGenerating = () => {
  console.log("Generating message to send to Slack");
};

export const slackMessageSending = () => {
  console.log("Sending message to Slack");
};

export const slackMessageSent = () => {
  console.log("Sent message to Slack");
};

export const start = () => {
  console.log("Started mod execution with configuration", config);
};
