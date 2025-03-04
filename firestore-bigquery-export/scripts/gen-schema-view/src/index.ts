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
import * as firebase from "firebase-admin";
import { FirestoreBigQuerySchemaViewFactory } from "./schema";
import { parseConfig } from "./config";

async function run(): Promise<number> {
  // Get all configuration options via inquirer prompt or commander flags.
  const config = await parseConfig();

  // Set project ID so it can be used in BigQuery intialization
  process.env.PROJECT_ID = config.projectId;
  // BigQuery actually requires this variable to set the project correctly.
  process.env.GOOGLE_CLOUD_PROJECT = config.bigQueryProjectId;

  // Initialize Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp({
      credential: firebase.credential.applicationDefault(),
      databaseURL: `https://${config.projectId}.firebaseio.com`,
    });
  }

  // @ts-ignore string not assignable to enum
  if (Object.keys(config.schemas).length === 0) {
    console.log(`No schema files found!`);
  }
  const viewFactory = new FirestoreBigQuerySchemaViewFactory(
    config.bigQueryProjectId
  );
  for (const schemaName in config.schemas) {
    await viewFactory.initializeSchemaViewResources(
      config.datasetId,
      config.tableNamePrefix,
      schemaName,
      config.schemas[schemaName]
    );
  }
  return 0;
}

run()
  .then(() => {
    console.log("done.");
    process.exit();
  })
  .catch((error) => {
    console.log(JSON.stringify(error));
    console.error(error.message);
    process.exit();
  });
