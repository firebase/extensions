/*
 * Copyright 2025 Google LLC
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

import type { CliConfig } from "../config";
import firebase = require("firebase-admin");
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import * as fs from "fs";
import * as path from "path";
import inquirer from "inquirer";

export async function sampleFirestoreDocuments(
  collectionPath: string,
  sampleSize: number,
  isCollectionGroupQuery: boolean = false
): Promise<any[]> {
  const db = firebase.firestore();

  try {
    const query = isCollectionGroupQuery
      ? db.collectionGroup(collectionPath)
      : db.collection(collectionPath);

    let snapshot = null;
    if (isCollectionGroupQuery) {
      snapshot = await query.limit(sampleSize).get();
    } else {
      snapshot = await query
        .where("__name__", ">=", Math.random().toString())
        .limit(sampleSize)
        .get();
    }

    const documents = snapshot.docs.map((doc) => {
      const data = doc.data();
      return serializeDocument(data);
    });

    return documents;
  } catch (error) {
    console.error("Error sampling documents:", error);
    throw error;
  }
}

export function serializeDocument(data: any): any {
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

const biqquerySchemaPrompt = ({
  collectionPath,
  sampleData,
}: {
  collectionPath: string;
  sampleData: any[];
}) => `
    You are a Schema Management Agent for Generating BigQuery schemas from Firestore Collections. 
    Your primary tasks are:
    1. Analyze the provided sample documents
    2. Generate an appropriate BigQuery schema
  
    I will provide you with sample documents from the collection "${collectionPath}".
  
    Here are the sample documents to analyze:
    ${JSON.stringify(sampleData, null, 2)}
  
    The schemas must follow this format:
    {
      "fields": [
        {
          "name": "fieldName",
          "type": "string|array|map|boolean|number|timestamp|geopoint|reference|null|stringified_map",
          "description": "Detailed description of what this field represents",
          "fields": [] // Only for type "map"
        }
      ]
    }
  
    Important schema rules:
    - Each field MUST have a "description" that explains its purpose and contents
    - For "map" types, include descriptions for both the map and its nested fields
    - Array fields should specify what type of elements they contain in the description
    - Include any relevant business logic or constraints in the descriptions
    - For fields with specific formats (like timestamps), include format information
  
    Example schema with good descriptions:
    {
      "fields": [
        {
          "name": "name",
          "type": "string",
          "description": "User's full name in display format"
        },
        {
          "name": "favorite_numbers",
          "type": "array",
          "description": "Array of user's favorite numbers, stored as strings"
        },
        {
          "name": "last_login",
          "type": "timestamp",
          "description": "Timestamp of user's most recent login in UTC"
        },
        {
          "name": "last_location",
          "type": "geopoint",
          "description": "User's last known geographical location as latitude/longitude"
        },
        {
          "fields": [
            {
              "name": "name",
              "type": "string",
              "description": "Friend's display name in the user's friend list"
            }
          ],
          "name": "friends",
          "type": "map",
          "description": "Collection of user's friends and their associated data"
        }
      ]
    }
  
    IMPORTANT: After analyzing the sample data:
    1. Generate a schema with detailed descriptions for ALL fields
    2. Make sure all fields are correctly represented in the schema, and described and formatted
    3. SQL has a number of reserved keywords that can cause conflicts when creating a schema, timestamp is one such example.
        To ensure your Firestore document field names do not conflict, use the column_name option to override the field name.
    for example:
        {
    "fields": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "age",
          "type": "number",
          "column_name": "new_column_name"
        }
    ]
    }
  
    Begin by analyzing the sample data and then create a well-documented schema.

    Remember that there is no need to destructure timestamp or geopoint fields, they can be left for example as:
    \`\`\`
    {
      "name": "last_login",
      "type": "timestamp"
    },
    {
      "name": "last_location",
      "type": "geopoint"
    },
    \`\`\`
    The script reading the generated schemas will deal with them appropriately.
    
    Please respond ONLY with the schema in json format
    `;

export const generateSchemaFilesWithGemini = async (config: CliConfig) => {
  //  get sample data from Firestore
  const sampleData = await sampleFirestoreDocuments(
    config.geminiAnalyzeCollectionPath!,
    config.agentSampleSize!,
    config.isCollectionGroupQuery || false
  );

  if (sampleData.length === 0) {
    console.log(
      "Operation cancelled. No sample data found. Either the collection is empty or the collection path is incorrect."
    );
    process.exit(0);
  }
  console.log(
    `Successfully sampled ${sampleData.length} documents from collection ${config.geminiAnalyzeCollectionPath}`
  );

  const prompt = biqquerySchemaPrompt({
    collectionPath: config.geminiAnalyzeCollectionPath!,
    sampleData,
  });

  // initialize genkit with googleAI plugin
  const ai = genkit({
    plugins: [
      googleAI({
        apiKey: config.googleAiKey,
      }),
    ],
  });

  // prompt gemini with sample data to generate a schema file
  const { text } = await ai.generate({
    model: googleAI.model("gemini-2.5-flash"),
    prompt,
    output: {
      format: "json",
      schema: z.object({
        fields: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            description: z.string(),
            fields: z.array(
              z.object({
                name: z.string(),
                type: z.string(),
                description: z.string(),
                fields: z.array(
                  z.object({
                    name: z.string(),
                    type: z.string(),
                    description: z.string(),
                    column_name: z.string().optional(),
                  })
                ),
              })
            ),
          })
        ),
      }),
    },
  });

  const filePath = path.join(
    config.schemaDirectory,
    `${config.geminiSchemaFileName}.json`
  );

  // Check if a file exists
  if (fs.existsSync(filePath)) {
    const overwriteConfirm = await inquirer.prompt([
      {
        type: "confirm",
        name: "proceed",
        message: "Schema file already exists. Would you like to overwrite it?",
        default: false,
      },
    ]);

    if (!overwriteConfirm.proceed) {
      console.log(
        "Operation cancelled. Please choose a different schema file name."
      );
      process.exit(0);
    }
  }
  await fs.promises.writeFile(filePath, text);

  const absoluteFilePath = path.resolve(filePath);

  console.log(`Schema file saved to: file://${absoluteFilePath}`);

  // confirm with user that schema file is correct
  const confirmation = await inquirer.prompt([
    {
      type: "confirm",
      name: "proceed",
      message: `Have you reviewed the schema, and want to proceed with creating the views?`,
      default: false,
    },
  ]);

  if (!confirmation.proceed) {
    console.log(
      "Operation cancelled. Please modify the schema file and run the script again."
    );
    process.exit(0);
  }
};
