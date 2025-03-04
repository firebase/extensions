import { gemini20Flash, googleAI } from "@genkit-ai/googleai";
import { Genkit, genkit, z } from "genkit";
import * as fs from "fs/promises";
import * as path from "path";
import { SchemaSchema } from "./genkitSchema"; // Assuming the schema is in a separate file

/**
 * Initializes Genkit with the Google AI plugin.
 *
 * @param {string} apiKey - The API key for Google AI.
 * @returns {ReturnType<typeof genkit>} - An instance of Genkit configured with the Google AI plugin.
 */
const initializeGenkit = (apiKey: string) => {
  return genkit({ plugins: [googleAI({ apiKey })] });
};

/**
 * Validates the content of a schema against the SchemaSchema.
 *
 * @param {string} content - The JSON string representation of the schema to validate.
 * @throws {Error} - Throws an error if the schema is invalid.
 * @returns {boolean} - Returns true if the schema is valid.
 */
const validateSchemaContent = (content: string) => {
  try {
    SchemaSchema.parse(JSON.parse(content));
    return true;
  } catch (error) {
    throw new Error(`Invalid schema content: ${error.message}`);
  }
};

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

/**
 * Defines the writeSchema tool for the Genkit agent.
 *
 * @param {ReturnType<typeof genkit>} ai - The Genkit instance.
 * @param {string} schemaDirectory - The directory where schema files are stored.
 * @returns {object} - The defined tool instance.
 */
const defineWriteSchemaTool = (
  ai: ReturnType<typeof genkit>,
  schemaDirectory: string
) => {
  return ai.defineTool(
    {
      name: "writeSchema",
      description: "Creates a new schema file",
      inputSchema: z.object({
        fileName: z.string().describe("Name of the schema file to create"),
        content: z.string().describe("JSON content of the schema"),
      }),
      outputSchema: z.string().describe("Result of the operation"),
    },
    async ({
      fileName,
      content,
    }: {
      fileName: string;
      content: string;
    }): Promise<string> => {
      try {
        validateSchemaContent(content);
        return await writeSchemaFile(schemaDirectory, fileName, content);
      } catch (error) {
        return `Error creating schema: ${error.message}`;
      }
    }
  );
};

/**
 * Defines the schema management agent for Genkit.
 *
 * @param {ReturnType<typeof genkit>} ai - The Genkit instance.
 * @param {string} schemaDirectory - The directory where schema files are stored.
 * @param {string} collectionName - The name of the Firestore collection.
 * @param {string} tablePrefix - The prefix for the generated BigQuery table schema.
 * @param {any[]} sampleData - Sample documents from the Firestore collection.
 * @returns {object} - The defined prompt instance.
 */
const defineSchemaAgent = (
  ai: Genkit,
  schemaDirectory: string,
  collectionName: string,
  tablePrefix: string,
  sampleData: any[]
): object => {
  const writeSchemaTool = defineWriteSchemaTool(ai, schemaDirectory);

  return ai.definePrompt(
    {
      name: "schemaAgent",
      description: "Agent for managing BigQuery schema files",
      tools: [writeSchemaTool],
      model: gemini20Flash,
    },
    `
    You are a Schema Management Agent for Generating BigQuery schemas from Firestore Collections. 
    Your primary tasks are:
    1. Analyze the provided sample documents
    2. Generate an appropriate BigQuery schema
    3. Save the schema using the writeSchema tool
  
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
    2. Use the writeSchema tool to save it as "${tablePrefix}.json"
    3. Confirm the schema was successfully saved
    4. Make sure all fields are correctly represented in the schema, and described and formatted
    5. SQL has a number of reserved keywords that can cause conflicts when creating a schema, timestamp is one such example.
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
  
    Begin by analyzing the sample data and create a well-documented schema.`
  );
};

/**
 * Main function to run the Genkit agent for schema management.
 *
 * @param {string} apiKey - The API key for Google AI.
 * @param {string} schemaDirectory - The directory where schema files are stored.
 * @param {string} collectionName - The name of the Firestore collection.
 * @param {string} tablePrefix - The prefix for the generated BigQuery table schema.
 * @param {any[]} sampleData - Sample documents from the Firestore collection.
 * @returns {Promise<any>} - The chat interface with the schema management agent.
 */
export const runAgent = (
  apiKey: string,
  schemaDirectory: string,
  collectionName: string,
  tablePrefix: string,
  sampleData: any[]
) => {
  const ai = initializeGenkit(apiKey);
  const schemaAgent = defineSchemaAgent(
    ai,
    schemaDirectory,
    collectionName,
    tablePrefix,
    sampleData
  );

  return ai.chat(schemaAgent);
};
