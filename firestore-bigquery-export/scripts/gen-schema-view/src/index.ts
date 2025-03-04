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

import firebase = require("firebase-admin");
import { FirestoreBigQuerySchemaViewFactory, FirestoreSchema } from "./schema";
import { readSchemas } from "./schema-loader-utils";
import { parseConfig } from "./config";
import { generateSchemaFilesWithGemini } from "./schema/genkit";

async function run(): Promise<number> {
  const config = await parseConfig();

  process.env.PROJECT_ID = config.projectId;
  process.env.GOOGLE_CLOUD_PROJECT = config.bigQueryProjectId;

  if (!firebase.apps.length) {
    firebase.initializeApp({
      credential: firebase.credential.applicationDefault(),
      databaseURL: `https://${config.projectId}.firebaseio.com`,
    });
  }

  const viewFactory = new FirestoreBigQuerySchemaViewFactory(
    config.bigQueryProjectId
  );

  // Generate schema files using Gemini if enabled
  // Otherwise, read schema files from the filesystem
  let schemas = config.schemas;
  if (config.useGemini) {
    try {
      await generateSchemaFilesWithGemini(config);
      schemas = readSchemas([`./schemas/${config.tableNamePrefix}.json`]);

      console.log("Schema views created successfully.");
    } catch (error) {
      console.error("Error during schema generation:", error);
      throw error;
    }
  } else {
    if (Object.keys(config.schemas).length === 0) {
      console.log(`No schema files found!`);
    }
  }

  // Initialize schema views
  for (const name in schemas) {
    await viewFactory.initializeSchemaViewResources(
      config.datasetId,
      config.tableNamePrefix,
      name,
      schemas[name]
    );
  }

  return 0;
}

if (process.env.NODE_ENV !== "test") {
  run()
    .then((result) => {
      console.log("done.");
      process.exit();
    })
    .catch((error) => {
      console.log(JSON.stringify(error));
      console.error(error.message);
      process.exit();
    });
}
