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

const { google } = require("googleapis");
const { auth } = require("google-auth-library");
const admin = require("firebase-admin");
const { PubSub } = require("@google-cloud/pubsub");

const PROJECT_ID = process.env.PROJECT_ID;
const PROJECT_NAME = `projects/${PROJECT_ID}`;
const TOPIC_NAME = process.env.TOPIC_NAME;

const billing = google.cloudbilling("v1").projects;
const pubsub = new PubSub({ PROJECT_ID });

// Initialize firebase app
admin.initializeApp();

/**
 * Determine whether topic exists
 * @param {string} topicName Name of project to check if billing is enabled
 * @return {bool} Whether project has billing enabled or not
 */
const _isTopicEnabled = async (topicName) => {
  const topic = await pubsub.topic(topicName);
  console.log(topic.name);
  console.log(topicName);
  return topic.name === `projects/{{projectId}}/topics/${topicName}`;
};

// Notify the user a new topic was created upon installation and set up is required.
_isTopicEnabled(TOPIC_NAME)
  .then((res) => {
    if (!res) {
      console.log(
        `Creating new topic named ${TOPIC_NAME}. NOTICE: Go to Billing to connect your budget to to topic ${TOPIC_NAME}.`
      );
    }
  })
  .catch((err) => {
    console.error(err);
  });

exports.sendBudgetNotifications = async (data, context) => {
  await _setAuthCredential();

  if (await _isBillingEnabled(PROJECT_NAME)) {
    if (await _isTopicEnabled(TOPIC_NAME)) {
      _postZapier(data);
    } else {
      console.log(
        `Topic was deleted. Creating new topic named ${TOPIC_NAME}. NOTICE: Go to Billing to connect your budget to to topic ${TOPIC_NAME}.`
      );
    }
  } else {
    console.error(
      `Billing is disabled for ${PROJECT_ID}. Please connect a billing account with this project.`
    );
  }
};

/**
 * @return {string} Zapier response or error / log
 */
const _postZapier = (data) => {
  const pubsubAttrs = JSON.stringify(data.attributes);
  const pubsubData = Buffer.from(data.data, "base64").toString();
  if (pubsubAttrs && pubsubAttrs.budgetId) {
    if (pubsubData.costAmount <= pubsubData.budgetAmount) {
      console.log(
        `No action necessary. (Current cost: ${
          pubsubData.costAmount
        } < Budget amount: ${pubsubData.budgetAmount})`
      );
      return;
    }
    console.log(
      `(Current cost: ${pubsubData.costAmount} > Budget amount: ${
        pubsubData.budgetAmount
      }). Sending to zapier...`
    );
    const options = {
      method: "POST",
      uri: process.env.ZAPIER_WEBHOOK,
      body,
      json: true,
    };
    rp(options)
      .then((parsedBody) => {
        console.log("Notification successfully ent to zapier: ", parsedBody);
      })
      .catch((err) => {
        console.error("Error posting to zapier: ", err);
      });
  } else {
    console.error(
      `Pubsub Message is not a Budget notification. Please verify ONLY your budget is subscribed to this topic: ${TOPIC_NAME}`
    );
  }
};

/**
 * @return {Promise} Credentials set globally
 */
const _setAuthCredential = async () => {
  const res = await auth.getApplicationDefault();

  let client = res.credential;
  if (client.hasScopes && !client.hasScopes()) {
    client = client.createScoped([
      "https://www.googleapis.com/auth/cloud-billing",
      "https://www.googleapis.com/auth/cloud-platform",
    ]);
  }

  // Set credential globally for all requests
  google.options({
    auth: client,
  });
};

/**
 * Determine whether billing is enabled for a project
 * @param {string} projectName Name of project to check if billing is enabled
 * @return {bool} Whether project has billing enabled or not
 */
const _isBillingEnabled = async (projectName) => {
  const res = await billing.getBillingInfo({ name: projectName });
  return res.data.billingEnabled;
};
