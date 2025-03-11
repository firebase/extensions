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

import { jest } from "@jest/globals";
import { BigQuery } from "@google-cloud/bigquery";
import { randomId } from "./helpers/setup";
import {
  FirestoreBigQuerySchemaViewFactory,
  FirestoreSchema,
} from "../../schema";
import { CliConfig } from "../../config"; // Import the CliConfig type

// Mock the modules we want to replace
jest.mock("../../config", () => ({
  parseConfig: jest.fn<() => Promise<CliConfig>>(),
}));

jest.mock("../../schema-loader-utils", () => ({
  readSchemas:
    jest.fn<(paths: string[]) => { [schemaName: string]: FirestoreSchema }>(),
}));

// Enhanced firebase-admin mock with firestore function
jest.mock("firebase-admin", () => ({
  apps: [],
  initializeApp: jest.fn(),
  credential: {
    applicationDefault: jest.fn(),
  },
  firestore: jest.fn(() => ({
    settings: jest.fn(),
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
      })),
    })),
  })),
}));

// Import the mocked modules
import { parseConfig } from "../../config";
import { readSchemas } from "../../schema-loader-utils";
import { run } from "../..";

const bq = new BigQuery({ projectId: "dev-extensions-testing" });
const datasetPrefix = "e2e_test_";

// Mock implementation of viewFactory.initializeSchemaViewResources
const mockInitializeSchemaViewResources = jest.fn();

// Mock the FirestoreBigQuerySchemaViewFactory class
jest.mock("../../schema", () => {
  const originalModule = jest.requireActual("../../schema") as object;
  return {
    ...originalModule,
    FirestoreBigQuerySchemaViewFactory: jest.fn().mockImplementation(() => {
      return {
        initializeSchemaViewResources: mockInitializeSchemaViewResources,
      };
    }),
  };
});

describe("e2e (mocking bq)", () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Configure BigQuery mock
    (mockInitializeSchemaViewResources as jest.Mock<any>).mockResolvedValue(
      undefined
    );
  });

  test("should generate a schema view based on a basic dataset and schema", async () => {
    // Set the schema to be tested
    const schemaName = "basic";

    // Generate Id for unique dataset name
    const id = randomId();
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

    // Create test schema
    const basicSchema: FirestoreSchema = {
      fields: [{ name: "name", type: "string" }],
    };

    // Mock the schemas object that would normally be loaded
    const schemas = {
      [schemaName]: basicSchema,
    };

    // Mock the config that parseConfig would return
    (parseConfig as jest.Mock<() => Promise<CliConfig>>).mockResolvedValue({
      projectId: "dev-extensions-testing",
      bigQueryProjectId: "dev-extensions-testing",
      datasetId: datasetId,
      tableNamePrefix: tableId,
      schemas: schemas,
      useGemini: false,
    });

    // Mock readSchemas in case it gets called
    (
      readSchemas as jest.Mock<
        (paths: string[]) => { [schemaName: string]: FirestoreSchema }
      >
    ).mockReturnValue(schemas);

    // Run the function
    const result = await run();

    // Verify parseConfig was called
    expect(parseConfig).toHaveBeenCalledTimes(1);

    // Verify FirestoreBigQuerySchemaViewFactory was initialized with the right project
    expect(FirestoreBigQuerySchemaViewFactory).toHaveBeenCalledWith(
      "dev-extensions-testing"
    );

    // Verify initializeSchemaViewResources was called with the right parameters
    expect(mockInitializeSchemaViewResources).toHaveBeenCalledWith(
      datasetId,
      tableId,
      schemaName,
      basicSchema
    );

    // Verify the run function returned 0 (success)
    expect(result).toBe(0);
  });

  test("should generate a schema view based on a nestedMapSchema dataset and schema", async () => {
    // Set the schema to be tested
    const schemaName = "nestedMapSchema";

    // Generate Id for unique dataset name
    const id = randomId();
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

    // Create test schema
    const nestedMapSchema: FirestoreSchema = {
      fields: [
        {
          name: "super",
          type: "map",
          fields: [
            {
              name: "nested",
              type: "map",
              fields: [
                {
                  name: "schema",
                  type: "map",
                  fields: [{ name: "value", type: "number" }],
                },
              ],
            },
          ],
        },
      ],
    };

    // Mock the schemas object
    const schemas = {
      [schemaName]: nestedMapSchema,
    };

    // Mock the config
    (parseConfig as jest.Mock<() => Promise<CliConfig>>).mockResolvedValue({
      projectId: "dev-extensions-testing",
      bigQueryProjectId: "dev-extensions-testing",
      datasetId: datasetId,
      tableNamePrefix: tableId,
      schemas: schemas,
      useGemini: false,
    });

    // Mock readSchemas
    (
      readSchemas as jest.Mock<
        (paths: string[]) => { [schemaName: string]: FirestoreSchema }
      >
    ).mockReturnValue(schemas);

    // Run the function
    const result = await run();

    // Verify initializeSchemaViewResources was called with the right parameters
    expect(mockInitializeSchemaViewResources).toHaveBeenCalledWith(
      datasetId,
      tableId,
      schemaName,
      nestedMapSchema
    );

    // Verify the run function returned 0 (success)
    expect(result).toBe(0);
  });

  test("should generate a schema view based on a arraysNestedInMapsSchema dataset and schema", async () => {
    // Set the schema to be tested
    const schemaName = "arraysNestedInMapsSchema";

    // Generate Id for unique dataset name
    const id = randomId();
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

    // Create test schema
    const arraysNestedInMapsSchema: FirestoreSchema = {
      fields: [
        {
          name: "map",
          type: "map",
          fields: [
            {
              name: "array",
              type: "array",
            },
          ],
        },
        {
          name: "map2",
          type: "map",
          fields: [
            {
              name: "array",
              type: "array",
            },
          ],
        },
      ],
    };

    // Mock the schemas object
    const schemas = {
      [schemaName]: arraysNestedInMapsSchema,
    };

    // Mock the config
    (parseConfig as jest.Mock<() => Promise<CliConfig>>).mockResolvedValue({
      projectId: "dev-extensions-testing",
      bigQueryProjectId: "dev-extensions-testing",
      datasetId: datasetId,
      tableNamePrefix: tableId,
      schemas: schemas,
      useGemini: false,
    });

    // Mock readSchemas
    (
      readSchemas as jest.Mock<
        (paths: string[]) => { [schemaName: string]: FirestoreSchema }
      >
    ).mockReturnValue(schemas);

    // Run the function
    const result = await run();

    // Verify initializeSchemaViewResources was called with the right parameters
    expect(mockInitializeSchemaViewResources).toHaveBeenCalledWith(
      datasetId,
      tableId,
      schemaName,
      arraysNestedInMapsSchema
    );

    // Verify the run function returned 0 (success)
    expect(result).toBe(0);
  });

  test("should generate a schema view based on a mappedArray dataset and schema", async () => {
    // Set the schema to be tested
    const schemaName = "mappedArray";

    // Generate Id for unique dataset name
    const id = randomId();
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

    // Create test schema
    const mappedArraySchema: FirestoreSchema = {
      fields: [
        { name: "name", type: "string" },
        { name: "date", type: "timestamp" },
        { name: "total", type: "number" },
        {
          name: "cartItems",
          type: "array",
          fields: [
            { name: "productName", type: "string" },
            { name: "quantity", type: "string" },
            { name: "isGift", type: "string" },
          ],
        },
      ],
    };

    // Mock the schemas object
    const schemas = {
      [schemaName]: mappedArraySchema,
    };

    // Mock the config
    (parseConfig as jest.Mock<() => Promise<CliConfig>>).mockResolvedValue({
      projectId: "dev-extensions-testing",
      bigQueryProjectId: "dev-extensions-testing",
      datasetId: datasetId,
      tableNamePrefix: tableId,
      schemas: schemas,
      useGemini: false,
    });

    // Mock readSchemas
    (
      readSchemas as jest.Mock<
        (paths: string[]) => { [schemaName: string]: FirestoreSchema }
      >
    ).mockReturnValue(schemas);

    // Run the function
    const result = await run();

    // Verify initializeSchemaViewResources was called with the right parameters
    expect(mockInitializeSchemaViewResources).toHaveBeenCalledWith(
      datasetId,
      tableId,
      schemaName,
      mappedArraySchema
    );

    // Verify the run function returned 0 (success)
    expect(result).toBe(0);
  });
});
