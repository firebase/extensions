import { gemini20FlashExp, googleAI } from "@genkit-ai/googleai";
import { genkit, z } from "genkit";
import * as fs from "fs/promises";
import * as path from "path";

// Define the schema structure for validation
const SchemaFieldType = z.enum([
  "string",
  "array",
  "map",
  "boolean",
  "number",
  "timestamp",
  "geopoint",
  "reference",
  "null",
  "stringified_map",
]);

const SchemaField = z.lazy(() =>
  z.object({
    name: z.string(),
    type: SchemaFieldType,
    description: z.string().optional(),
    fields: z.array(SchemaField).optional(),
  })
);

const Schema = z.object({
  fields: z.array(SchemaField),
});

export const runAgent = (
  apiKey: string,
  schemaDirectory: string,
  collectionName: string,
  tablePrefix: string,
  sampleData: any[]
) => {
  const ai = genkit({ plugins: [googleAI({ apiKey })] });

  // Tool to write a new schema file
  const writeSchemaTool = ai.defineTool(
    {
      name: "writeSchema",
      description: "Creates a new schema file",
      inputSchema: z.object({
        fileName: z.string().describe("Name of the schema file to create"),
        content: z.string().describe("JSON content of the schema"),
      }),
      outputSchema: z.string().describe("Result of the operation"),
    },
    async ({ fileName, content }) => {
      const filePath = path.join(schemaDirectory, fileName);
      try {
        // Validate schema structure before writing
        Schema.parse(JSON.parse(content));

        // Check if file already exists
        try {
          await fs.access(filePath);
          return "Error: Schema file already exists";
        } catch {
          // File doesn't exist, proceed with writing
          await fs.writeFile(filePath, content);
          return "Schema created successfully";
        }
      } catch (error) {
        return `Error creating schema: ${error.message}`;
      }
    }
  );

  // Define the schema management agent
  const schemaAgent = ai.definePrompt(
    {
      name: "schemaAgent",
      description: "Agent for managing BigQuery schema files",
      tools: [writeSchemaTool],
      model: gemini20FlashExp,
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

  // Return the chat interface
  return ai.chat(schemaAgent);
};
