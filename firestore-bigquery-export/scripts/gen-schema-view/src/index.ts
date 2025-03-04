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
import inquirer from "inquirer";
import { FirestoreBigQuerySchemaViewFactory, FirestoreSchema } from "./schema";
import { readSchemas } from "./schema-loader-utils";
import { runAgent } from "./schema/genkit";
import { parseConfig } from "./config";

export async function sampleFirestoreDocuments(
  collectionPath: string,
  sampleSize: number
): Promise<any[]> {
  const db = firebase.firestore();

  try {
    const snapshot = await db
      .collection(collectionPath)
      .where("__name__", ">=", Math.random().toString())
      .limit(sampleSize)
      .get();

    const documents = snapshot.docs.map((doc) => {
      const data = doc.data();
      return serializeDocument(data);
    });

    console.log(`Successfully sampled ${documents.length} documents.`);
    return documents;
  } catch (error) {
    console.error("Error sampling documents:", error);
    throw error;
  }
}

function serializeDocument(data: any): any {
  if (!data) return null;

  if (data instanceof Date) {
    return { _type: "timestamp", value: data.toISOString() };
  }

  if (data instanceof firebase.firestore.GeoPoint) {
    return {
      _type: "geopoint",
      latitude: data.latitude,
      longitude: data.longitude,
    };
  }

  if (data instanceof firebase.firestore.DocumentReference) {
    return { _type: "reference", path: data.path };
  }

  if (Array.isArray(data)) {
    return data.map((item) => serializeDocument(item));
  }

  if (typeof data === "object") {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeDocument(value);
    }
    return result;
  }

  return data;
}

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

  if (config.useGemini) {
    // TODO: move to genkit subdirectory
    try {
      const sampleData = await sampleFirestoreDocuments(
        config.collectionPath!,
        config.agentSampleSize!
      );
      const chat = runAgent(
        config.googleAiKey!,
        // TODO: set this somehow from user input
        "./schemas",
        config.tableNamePrefix,
        config.collectionPath!,
        sampleData
      );
      await chat.send(
        `Please analyze these documents and generate an appropriate BigQuery schema. ` +
          `**Then use the writeSchema tool to save it as "${config.tableNamePrefix}.json**". ` +
          `Let me know once you've created the schema file.`
      );
      const schemaName = `${config.tableNamePrefix}`;
      const schemas = readSchemas([`./schemas/${schemaName}.json`]);

      if (!schemas[schemaName]) {
        console.error(
          `Error reading schema file: ./schemas/${schemaName}.json. Gemini may have failed to generate the schema.
          If the issue persists, please manually create the schema file and run the script again.`
        );
        process.exit(1);
      }

      const schemaPath = `./schemas/${config.tableNamePrefix}.json`;
      console.log(
        `\nSchema generation complete. The schema file has been created at: ${schemaPath}. Please review the schema file and confirm if you want to proceed.`
      );

      const confirmation = await inquirer.prompt([
        {
          type: "confirm",
          name: "proceed",
          message:
            "Have you reviewed the schema and want to proceed with creating the views?",
          default: false,
        },
      ]);

      if (!confirmation.proceed) {
        console.log(
          "Operation cancelled. Please modify the schema file and run the script again."
        );
        process.exit(0);
      }

      for (const name in schemas) {
        await viewFactory.initializeSchemaViewResources(
          config.datasetId,
          config.tableNamePrefix,
          name,
          schemas[name]
        );
      }

      console.log("Schema views created successfully.");
    } catch (error) {
      console.error("Error during schema generation:", error);
      throw error;
    }
  } else {
    if (Object.keys(config.schemas).length === 0) {
      console.log(`No schema files found!`);
    }

    for (const schemaName in config.schemas) {
      await viewFactory.initializeSchemaViewResources(
        config.datasetId,
        config.tableNamePrefix,
        schemaName,
        config.schemas[schemaName]
      );
    }
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
