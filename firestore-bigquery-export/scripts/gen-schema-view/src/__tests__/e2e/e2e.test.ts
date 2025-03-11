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
import { getQueryResult, randomId, setupBQ } from "./helpers/setup";
import { FirestoreSchema } from "../../schema";
import { CliConfig } from "../../config";

// Mock only the config module
jest.mock("../../config", () => ({
  parseConfig: jest.fn<() => Promise<CliConfig>>(),
}));

import { parseConfig } from "../../config";
import { run } from "../..";

const bq = new BigQuery({ projectId: "dev-extensions-testing" });
const datasetPrefix = "e2e_test_";

async function verifySetupBQ(
  datasetId: string,
  tableId: string,
  testData: any
) {
  try {
    const query = `
      SELECT data
      FROM \`dev-extensions-testing.${datasetId}.${tableId}_raw_latest\`
      LIMIT 1
    `;

    const [rows] = await bq.query({ query });

    if (rows.length === 0) {
      return { success: false, errors: ["No rows found in latest table"] };
    }

    const rowData = JSON.parse(rows[0].data);
    const success = Object.keys(testData).every(
      (key) => JSON.stringify(rowData[key]) === JSON.stringify(testData[key])
    );

    return {
      success,
      errors: success ? [] : ["Data in table doesn't match expected test data"],
    };
  } catch (error) {
    return { success: false, errors: [String(error)] };
  }
}

describe("e2e (with real BigQuery)", () => {
  let id: string;

  beforeEach(async () => {
    id = randomId();
    jest.clearAllMocks();
  });

  test("should generate a schema view based on a basic dataset and schema", async () => {
    const schemaName = "basic";
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

    const basicSchema: FirestoreSchema = {
      fields: [{ name: "name", type: "string" }],
    };

    const testData = { name: "test" };

    const { dataset } = await setupBQ(datasetId, tableId, testData);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const verifySetup = await verifySetupBQ(datasetId, tableId, testData);
    if (!verifySetup.success)
      throw new Error(`Setup failed: ${verifySetup.errors.join(", ")}`);

    (parseConfig as jest.Mock<() => Promise<CliConfig>>).mockResolvedValue({
      projectId: "dev-extensions-testing",
      bigQueryProjectId: "dev-extensions-testing",
      datasetId,
      tableNamePrefix: tableId,
      schemas: { [schemaName]: basicSchema },
      useGemini: false,
    });

    const result = await run();
    expect(result).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 10000));

    const queryResult = await getQueryResult(datasetId, tableId, schemaName);
    expect(queryResult.length).toBe(1);
    expect(queryResult[0].name).toBe("test");
  }, 60000);

  test("should generate a schema view based on a nestedMapSchema dataset and schema", async () => {
    const schemaName = "nestedMapSchema";
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

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

    const testData = { super: { nested: { schema: { value: 1 } } } };

    const { dataset } = await setupBQ(datasetId, tableId, testData);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const verifySetup = await verifySetupBQ(datasetId, tableId, testData);
    if (!verifySetup.success)
      throw new Error(`Setup failed: ${verifySetup.errors.join(", ")}`);

    (parseConfig as jest.Mock<() => Promise<CliConfig>>).mockResolvedValue({
      projectId: "dev-extensions-testing",
      bigQueryProjectId: "dev-extensions-testing",
      datasetId,
      tableNamePrefix: tableId,
      schemas: { [schemaName]: nestedMapSchema },
      useGemini: false,
    });

    const result = await run();
    expect(result).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 10000));

    const queryResult = await getQueryResult(datasetId, tableId, schemaName);
    expect(queryResult.length).toBe(1);
    expect(queryResult[0].super_nested_schema_value.toString()).toBe("1");
  }, 60000);

  test("should generate a schema view based on an arraysNestedInMapsSchema dataset and schema", async () => {
    const schemaName = "arraysNestedInMapsSchema";
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

    const arraysNestedInMapsSchema: FirestoreSchema = {
      fields: [
        {
          name: "map",
          type: "map",
          fields: [{ name: "array", type: "array" }],
        },
        {
          name: "map2",
          type: "map",
          fields: [{ name: "array", type: "array" }],
        },
      ],
    };

    const testData = { map: { array: [] }, map2: { array: [] } };

    const { dataset } = await setupBQ(datasetId, tableId, testData);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const verifySetup = await verifySetupBQ(datasetId, tableId, testData);
    if (!verifySetup.success)
      throw new Error(`Setup failed: ${verifySetup.errors.join(", ")}`);

    (parseConfig as jest.Mock<() => Promise<CliConfig>>).mockResolvedValue({
      projectId: "dev-extensions-testing",
      bigQueryProjectId: "dev-extensions-testing",
      datasetId,
      tableNamePrefix: tableId,
      schemas: { [schemaName]: arraysNestedInMapsSchema },
      useGemini: false,
    });

    const result = await run();
    expect(result).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 10000));

    const queryResult = await getQueryResult(datasetId, tableId, schemaName);
    expect(queryResult.length).toBe(1);
    expect(queryResult[0].map_array).toEqual([]);
    expect(queryResult[0].map2_array).toEqual([]);
  }, 60000);

  test("should generate a schema view based on a simple mappedArray dataset and schema", async () => {
    const schemaName = "mappedArray";
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

    const mappedArraySchema: FirestoreSchema = {
      fields: [
        { name: "name", type: "string" },
        { name: "total", type: "number" },
        {
          name: "cartItems",
          type: "array",
          fields: [{ name: "productName", type: "string" }],
        },
      ],
    };

    const testData = {
      name: "test",
      total: 1,
      cartItems: [{ productName: "test" }],
    };

    await setupBQ(datasetId, tableId, testData);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const verifySetup = await verifySetupBQ(datasetId, tableId, testData);
    if (!verifySetup.success)
      throw new Error(`Setup failed: ${verifySetup.errors.join(", ")}`);

    (parseConfig as jest.Mock<() => Promise<CliConfig>>).mockResolvedValue({
      projectId: "dev-extensions-testing",
      bigQueryProjectId: "dev-extensions-testing",
      datasetId,
      tableNamePrefix: tableId,
      schemas: { [schemaName]: mappedArraySchema },
      useGemini: false,
    });

    const result = await run();
    expect(result).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 10000));

    const queryResult = await getQueryResult(datasetId, tableId, schemaName);
    expect(queryResult.length).toBe(1);
    expect(queryResult[0].name).toBe("test");
    expect(queryResult[0].cartItems.length).toBe(1);
  }, 60000);

  test("should generate a schema view based on a mappedArray dataset and schema", async () => {
    const schemaName = "mappedArray";
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

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

    const testData = {
      name: "test",
      date: new Date(),
      total: 1,
      cartItems: [{ productName: "test", quantity: "test", isGift: "Yes" }],
    };

    const { dataset } = await setupBQ(datasetId, tableId, testData);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const verifySetup = await verifySetupBQ(datasetId, tableId, testData);
    if (!verifySetup.success)
      throw new Error(`Setup failed: ${verifySetup.errors.join(", ")}`);

    (parseConfig as jest.Mock<() => Promise<CliConfig>>).mockResolvedValue({
      projectId: "dev-extensions-testing",
      bigQueryProjectId: "dev-extensions-testing",
      datasetId,
      tableNamePrefix: tableId,
      schemas: { [schemaName]: mappedArraySchema },
      useGemini: false,
    });

    const result = await run();
    expect(result).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 10000));

    const queryResult = await getQueryResult(datasetId, tableId, schemaName);

    console.log("queryResult: ", queryResult[0]);
    expect(queryResult.length).toBe(1);
    expect(queryResult[0].name).toBe("test");
    // Depending on the BigQuery schema conversion, numeric fields may be returned as strings.
    expect(JSON.stringify(JSON.parse(queryResult[0].total))).toBe("1");
    expect(queryResult[0].cartItems[0]).toBe(
      '{"productName":"test","quantity":"test","isGift":"Yes"}'
    );
    expect(queryResult[0].cartItems_index).toBe(0);
    expect(queryResult[0].cartItems_member).toBe(
      '{"productName":"test","quantity":"test","isGift":"Yes"}'
    );
  }, 60000);
});
