#!/usr/bin/env node

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

import * as program from "commander";
import * as firebase from "firebase-admin";
import admin = require("firebase-admin");
import * as inquirer from "inquirer";
import Mailchimp = require("mailchimp-api-v3");

const FIRESTORE_VALID_CHARACTERS = /^[^\/]+$/;

const validateInput = (value: any, name: string, regex: RegExp) => {
  if (!value || value === "" || value.trim() === "") {
    return `Please supply a ${name}`;
  }
  if (!value.match(regex)) {
    return `The ${name} must only contain letters or spaces`;
  }
  return true;
};

function collect(value, previous) {
  return previous.concat([value]);
}

program
  .name("sync-contacts")
  .option(
    "--non-interactive",
    "Parse all input from command line flags instead of prompting the caller.",
    false
  )
  .option(
    "-p, --project <project>",
    "Firebase Project ID for project containing Cloud Firestore database."
  )
  .option(
    "-k, --apikey <mailchimpApikey>",
    "The Mailchimp API key? To obtain a Mailchimp API key, go to your [Mailchimp account](https://admin.mailchimp.com/account/api/)."
  )
  .option(
    "-a, --audeince <mailchimpAudienceId>",
    "The Mailchimp audience Id. To find your Audience ID: visit https://admin.mailchimp.com/lists"
  )
  .option(
    "-s, --status <mailchimpContactStatus>",
    "What is the contact status? (subscribed / pending)"
  )
  .option(
    "-s, --account <privateKeyPath>",
    "The Service Account path",
    collect,
    []
  );

const questions = [
  {
    message: "What is your Firebase project ID?",
    name: "project",
    type: "input",
    validate: (value) =>
      validateInput(value, "project ID", FIRESTORE_VALID_CHARACTERS),
  },
  {
    message: "What is your mailchimp key?",
    name: "mailchimpApikey",
    type: "input",
  },
  {
    message: "What is the audeience Id for mail-chimp?",
    name: "mailchimpAudienceId",
    type: "input",
  },
  {
    message: "What is the contact status?",
    name: "mailchimpContactStatus",
    type: "list",
    choices: ["subscribed", "pending"],
  },
  {
    default: "../key.json",
    message:
      "What is the path to the service account private key for your Firebase Project?",
    name: "privateKeyPath",
    type: "input",
    validate: (value) => !!value.length,
  },
];

interface CliConfig {
  projectId: string;
  mailchimpApikey: string;
  mailchimpAudienceId: string;
  mailchimpContactStatus: string;
  privateKeyPath: string;
}

async function parseConfig(): Promise<CliConfig> {
  program.parse(process.argv);
  if (program.nonInteractive) {
    if (
      program.project === undefined ||
      program.mailchimpApikey === undefined ||
      program.mailchimpAudienceId === undefined ||
      program.mailchimpContactStatus === undefined ||
      program.privateKeyPath === undefined
    ) {
      program.outputHelp();
      process.exit(1);
    }
    return {
      projectId: program.project,
      mailchimpApikey: program.mailchimpApikey,
      mailchimpAudienceId: program.mailchimpAudienceId,
      mailchimpContactStatus: program.mailchimpContactStatus,
      privateKeyPath: program.privateKeyPath,
    };
  }
  const {
    project,
    mailchimpApikey,
    mailchimpAudienceId,
    mailchimpContactStatus,
    privateKeyPath,
  } = await inquirer.prompt(questions);
  return {
    projectId: project,
    mailchimpApikey,
    mailchimpAudienceId,
    mailchimpContactStatus,
    privateKeyPath,
  };
}

function initMailchimp(mailchimpApiKey): Mailchimp {
  try {
    return new Mailchimp(mailchimpApiKey);
  } catch (err) {
    console.log(
      "Failed to Initialize Mailchimp, please checkout the correct Api key has been used."
    );
    return null;
  }
}

async function syncContacts(config, token): Promise<void> {
  const mailchimp = initMailchimp(config.mailchimpApikey);

  if (!mailchimp) return Promise.resolve();

  const qs = "?skip_merge_validation=true&skip_duplicate_check=true";

  const { users, pageToken } = token
    ? await admin.auth().listUsers(1000, token)
    : await admin.auth().listUsers(1000);

  await mailchimp.post(`/lists/${config.mailchimpAudienceId}${qs}`, {
    members: users
      .filter(($) => !!$.email)
      .map(({ email }) => {
        return {
          email_address: email,
          status: config.mailchimpContactStatus,
        };
      }),
    update_existing: false,
  });

  return pageToken ? syncContacts(config, pageToken) : Promise.resolve();
}

async function run(): Promise<void> {
  // Get all configuration options via inquirer prompt or commander flags.
  const config: CliConfig = await parseConfig();

  var serviceAccount = require(config.privateKeyPath);

  // Initialize Firebase
  firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: `https://${config.projectId}.firebaseio.com`,
  });

  return syncContacts(config, null);
}

run()
  .then(() => {
    console.log("Completed");
    process.exit();
  })
  .catch((error) => {
    console.log(JSON.stringify(error));
    console.error(error.message);
    process.exit();
  });
