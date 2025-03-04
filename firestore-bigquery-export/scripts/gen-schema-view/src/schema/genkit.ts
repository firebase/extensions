import type { CliConfig } from "../config";
import firebase = require("firebase-admin");
import { genkit, z } from "genkit";
import { googleAI, gemini20Flash } from "@genkit-ai/googleai";
import * as fs from "fs/promises";
import * as path from "path";
import inquirer from "inquirer";
import {SchemaSchema} from './genkitSchema'

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

/**
 * Writes a schema file to the specified directory if it does not already exist.
 *
 * @param {string} schemaDirectory - The directory where schema files are stored.
 * @param {string} fileName - The name of the schema file to write.
 * @param {string} content - The content of the schema file as a JSON string.
 * @returns {Promise<string>} - A message indicating success or an error if the file already exists.
 */
const writeSchemaFile = async (
  schemaDirectory: string,
  fileName: string,
  content: string
): Promise<string> => {
  const filePath = path.join(schemaDirectory, fileName);
  try {
    await fs.access(filePath);
    return "Error: Schema file already exists";
  } catch {
    await fs.writeFile(filePath, content);
    return "Schema created successfully";
  }
};

const biqquerySchemaPrompt = ({
  collectionName,
  sampleData,
  tablePrefix,
}: {
  collectionName: string;
  sampleData: any[];
  tablePrefix: string;
}) => `
    You are a Schema Management Agent for Generating BigQuery schemas from Firestore Collections. 
    Your primary tasks are:
    1. Analyze the provided sample documents
    2. Generate an appropriate BigQuery schema
  
    I will provide you with sample documents from the collection "${collectionName}".
  
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
    
    Please respond ONLY with the schema in json format
    `;

export const generateSchemaFilesWithGemini = async (config: CliConfig) => {
  //  get sample data from Firestore
  const sampleData = await sampleFirestoreDocuments(
    config.collectionPath!,
    config.agentSampleSize!
  );

  const prompt = biqquerySchemaPrompt({
    collectionName: config.collectionPath!,
    sampleData,
    tablePrefix: config.tableNamePrefix,
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
  const { text, output } = await ai.generate({
    model: gemini20Flash,
    prompt,
    output: {
      format: 'json',
      schema: z.any()
    }
  });

  throw new Error(`gets to here ${JSON.stringify(output)}`)

  console.log("this is output",output)

  console.log(text);

  await writeSchemaFile("./schemas", `${config.tableNamePrefix}.json`, text);
  // confirm with user that schema file is correct
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
};
