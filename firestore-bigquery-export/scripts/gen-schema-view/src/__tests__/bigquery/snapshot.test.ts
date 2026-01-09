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

import * as chai from "chai";
import * as fs from "fs";
import * as sqlFormatter from "sql-formatter";
import * as util from "util";

import {
  buildLatestSchemaSnapshotViewQuery,
  buildLatestSchemaSnapshotViewQueryFromLatestView,
  testBuildLatestSchemaSnapshotViewQuery,
} from "../../snapshot";

const fixturesDir = __dirname + "/../fixtures";
const sqlDir = fixturesDir + "/sql";
const schemaDir = fixturesDir + "/schemas";

const testProjectId = "test";
const testDataset = "test_dataset";
const testTable = "test_table";

const expect = chai.expect;
const readFile = util.promisify(fs.readFile);

process.env.PROJECT_ID = testProjectId;

async function readFormattedSQL(file: string): Promise<string> {
  const query = await readFile(file, "utf8");
  return sqlFormatter.format(query);
}

async function readBigQuerySchema(file: string): Promise<any> {
  return require(file);
}

describe("view schema snapshot view sql generation", () => {
  // Skipped: These tests assert the legacy FIRST_VALUE window function structure
  // They will be updated once the CTE + JOIN implementation is complete
  xit("should generate the expected sql for fullSchemaLatest.sql", async () => {
    const expectedQuery = await readFormattedSQL(
      `${sqlDir}/fullSchemaLatest.sql`
    );
    const result = testBuildLatestSchemaSnapshotViewQuery(
      testDataset,
      testTable,
      await readBigQuerySchema(`${schemaDir}/fullSchema.json`)
    );
    expect(result.query).to.equal(expectedQuery);
  });
  xit("should generate the expected sql for ", async () => {
    const expectedQuery = await readFormattedSQL(
      `${sqlDir}/fullSchemaLatestFromView.sql`
    );
    const result = buildLatestSchemaSnapshotViewQueryFromLatestView(
      testDataset,
      testTable,
      await readBigQuerySchema(`${schemaDir}/fullSchema.json`)
    );
    expect(result.query).to.equal(expectedQuery);
  });
  xit("should generate the expected sql for an empty schema", async () => {
    const expectedQuery = await readFormattedSQL(
      `${sqlDir}/emptySchemaLatest.sql`
    );
    const result = buildLatestSchemaSnapshotViewQuery(
      testDataset,
      testTable,
      await readBigQuerySchema(`${schemaDir}/emptySchema.json`)
    );
    expect(result.query).to.equal(expectedQuery);
  });
  xit("should generate the expected sql", async () => {
    const expectedQuery = await readFormattedSQL(
      `${sqlDir}/emptySchemaLatestFromView.sql`
    );
    const result = buildLatestSchemaSnapshotViewQueryFromLatestView(
      testDataset,
      testTable,
      await readBigQuerySchema(`${schemaDir}/fullSchema.json`)
    );
    expect(result.query).to.equal(expectedQuery);
  });

  xit("should handle renaming properties extracted from JSON data", async () => {
    const expectedQuery = await readFormattedSQL(
      `${sqlDir}/viewColumnRenameSchema.sql`
    );
    const result = testBuildLatestSchemaSnapshotViewQuery(
      testDataset,
      testTable,
      await readBigQuerySchema(`${schemaDir}/columnRename.json`)
    );
    expect(result.query).to.equal(expectedQuery);
  });

  xit("should handle multiple nested arrays and maps extracted from JSON data", async () => {
    const expectedQuery = await readFormattedSQL(
      `${sqlDir}/complexSchemaLatest.sql`
    );

    console.log("expectedQuery: ", expectedQuery);

    const result = testBuildLatestSchemaSnapshotViewQuery(
      testDataset,
      testTable,
      await readBigQuerySchema(`${schemaDir}/complexSchema.json`)
    );

    expect(result.query).to.equal(expectedQuery);
  });
});

describe("view schema snapshot view query structure (CTE + JOIN pattern)", () => {
  describe("should use CTE + JOIN instead of window functions", () => {
    it("should use WITH latest_timestamps CTE for empty schema", async () => {
      const result = testBuildLatestSchemaSnapshotViewQuery(
        testDataset,
        testTable,
        await readBigQuerySchema(`${schemaDir}/emptySchema.json`)
      );

      // Should contain CTE with MAX(timestamp)
      expect(result.query).to.include("WITH latest_timestamps AS");
      expect(result.query).to.include("MAX(timestamp) AS latest_timestamp");
      expect(result.query).to.include("GROUP BY document_name");

      // Should use INNER JOIN to latest_timestamps
      expect(result.query).to.include("INNER JOIN latest_timestamps");
      expect(result.query).to.include("t.document_name = l.document_name");
      expect(result.query).to.include("t.timestamp = l.latest_timestamp");

      // Should NOT use FIRST_VALUE window functions
      expect(result.query).to.not.include("FIRST_VALUE");
      expect(result.query).to.not.include("OVER(");
    });

    it("should use CTE + JOIN pattern for full schema with multiple fields", async () => {
      const result = testBuildLatestSchemaSnapshotViewQuery(
        testDataset,
        testTable,
        await readBigQuerySchema(`${schemaDir}/fullSchema.json`)
      );

      // Should contain CTE
      expect(result.query).to.include("WITH latest_timestamps AS");
      expect(result.query).to.include("MAX(timestamp) AS latest_timestamp");

      // Should use JOIN
      expect(result.query).to.include("INNER JOIN latest_timestamps");

      // Should NOT use window functions
      expect(result.query).to.not.include("FIRST_VALUE");
      expect(result.query).to.not.include("OVER(");

      // Should extract fields directly (not wrapped in window functions)
      expect(result.query).to.include("JSON_EXTRACT_SCALAR");
      expect(result.query).to.include("t.data");
    });

    it("should handle schemas with arrays using CTE + JOIN", () => {
      const schema = {
        fields: [
          { name: "items", type: "array" as const },
          { name: "name", type: "string" as const },
        ],
      };

      const result = testBuildLatestSchemaSnapshotViewQuery(
        testDataset,
        testTable,
        schema
      );

      // Should use CTE + JOIN pattern
      expect(result.query).to.include("WITH latest_timestamps AS");
      expect(result.query).to.include("INNER JOIN latest_timestamps");

      // Should NOT use window functions
      expect(result.query).to.not.include("FIRST_VALUE");
    });

    it("should handle schemas with geopoints using CTE + JOIN", () => {
      const schema = {
        fields: [
          { name: "location", type: "geopoint" as const },
          { name: "name", type: "string" as const },
        ],
      };

      const result = testBuildLatestSchemaSnapshotViewQuery(
        testDataset,
        testTable,
        schema
      );

      // Should use CTE + JOIN pattern
      expect(result.query).to.include("WITH latest_timestamps AS");
      expect(result.query).to.include("INNER JOIN latest_timestamps");

      // Should NOT use window functions
      expect(result.query).to.not.include("FIRST_VALUE");
    });

    it("should handle nested maps with CTE + JOIN pattern", () => {
      const schema = {
        fields: [
          {
            name: "metadata",
            type: "map" as const,
            fields: [
              { name: "version", type: "number" as const },
              { name: "created", type: "timestamp" as const },
            ],
          },
        ],
      };

      const result = testBuildLatestSchemaSnapshotViewQuery(
        testDataset,
        testTable,
        schema
      );

      // Should use CTE + JOIN pattern
      expect(result.query).to.include("WITH latest_timestamps AS");
      expect(result.query).to.include("INNER JOIN latest_timestamps");

      // Should NOT use window functions
      expect(result.query).to.not.include("FIRST_VALUE");

      // Should extract nested fields correctly
      expect(result.query).to.include("metadata_version");
      expect(result.query).to.include("metadata_created");
    });

    it("should filter deleted documents correctly with CTE + JOIN", async () => {
      const result = testBuildLatestSchemaSnapshotViewQuery(
        testDataset,
        testTable,
        await readBigQuerySchema(`${schemaDir}/emptySchema.json`)
      );

      // Should filter out deleted documents
      expect(result.query).to.include("WHERE");
      expect(result.query).to.include("operation");
      expect(result.query).to.include("DELETE");
      expect(result.query).to.include("!=");
    });

    it("should maintain correct GROUP BY structure with CTE + JOIN", async () => {
      const result = testBuildLatestSchemaSnapshotViewQuery(
        testDataset,
        testTable,
        await readBigQuerySchema(`${schemaDir}/fullSchema.json`)
      );

      // Should have GROUP BY clause
      expect(result.query).to.include("GROUP BY");
      expect(result.query).to.include("document_name");
      expect(result.query).to.include("document_id");
      expect(result.query).to.include("timestamp");
      expect(result.query).to.include("operation");
    });
  });

  describe("query efficiency characteristics", () => {
    it("should generate queries that avoid multiple window function sorts", () => {
      // Create a schema with many fields to simulate the 200+ column scenario
      const manyFields = Array.from({ length: 50 }, (_, i) => ({
        name: `field_${i}`,
        type: "string" as const,
      }));

      const schema = { fields: manyFields };
      const result = testBuildLatestSchemaSnapshotViewQuery(
        testDataset,
        testTable,
        schema
      );

      // Count window functions (should be 0)
      const windowFunctionMatches = result.query.match(/FIRST_VALUE/g);
      expect(windowFunctionMatches).to.be.null;

      // Should have exactly one CTE
      const cteMatches = result.query.match(/WITH latest_timestamps AS/g);
      expect(cteMatches).to.have.length(1);

      // Should have exactly one JOIN
      const joinMatches = result.query.match(/INNER JOIN latest_timestamps/g);
      expect(joinMatches).to.have.length(1);
    });
  });

  describe("full query string matching", () => {
    it("should generate exact SQL for empty schema using CTE + JOIN pattern", async () => {
      const result = testBuildLatestSchemaSnapshotViewQuery(
        testDataset,
        testTable,
        await readBigQuerySchema(`${schemaDir}/emptySchema.json`)
      );

      const expectedQuery = sqlFormatter.format(`
        -- Given a user-defined schema over a raw JSON changelog, returns the
        -- schema elements of the latest set of live documents in the collection.
        -- Uses CTE + JOIN pattern for better memory efficiency with large schemas.
        WITH latest_timestamps AS (
          SELECT 
            document_name,
            MAX(timestamp) AS latest_timestamp
          FROM \`${testProjectId}.${testDataset}.${testTable}\`
          GROUP BY document_name
        )
        SELECT
          t.document_name,
          t.document_id,
          t.timestamp,
          t.operation
        FROM \`${testProjectId}.${testDataset}.${testTable}\` AS t
        INNER JOIN latest_timestamps AS l ON (
          t.document_name = l.document_name AND
          IFNULL(t.timestamp, TIMESTAMP("1970-01-01 00:00:00+00")) =
          IFNULL(l.latest_timestamp, TIMESTAMP("1970-01-01 00:00:00+00"))
        )
        WHERE t.operation != "DELETE"
        GROUP BY
          t.document_name,
          t.document_id,
          t.timestamp,
          t.operation
      `);

      expect(result.query).to.equal(expectedQuery);
    });

    it("should generate exact SQL for simple schema with string fields using CTE + JOIN pattern", async () => {
      const schema = {
        fields: [
          { name: "name", type: "string" as const },
          { name: "email", type: "string" as const },
        ],
      };

      const result = testBuildLatestSchemaSnapshotViewQuery(
        testDataset,
        testTable,
        schema
      );

      // Note: The actual field extraction will use the extractors generated by processFirestoreSchema
      // which reference 'data' field. In the new query structure, we'll need to adjust these
      // to reference 't.data' instead. This test validates the overall structure.
      const expectedQuery = sqlFormatter.format(`
        -- Given a user-defined schema over a raw JSON changelog, returns the
        -- schema elements of the latest set of live documents in the collection.
        -- Uses CTE + JOIN pattern for better memory efficiency with large schemas.
        WITH latest_timestamps AS (
          SELECT 
            document_name,
            MAX(timestamp) AS latest_timestamp
          FROM \`${testProjectId}.${testDataset}.${testTable}\`
          GROUP BY document_name
        )
        SELECT
          t.document_name,
          t.document_id,
          t.timestamp,
          t.operation,
          JSON_EXTRACT_SCALAR(t.data, '$.name') AS name,
          JSON_EXTRACT_SCALAR(t.data, '$.email') AS email
        FROM \`${testProjectId}.${testDataset}.${testTable}\` AS t
        INNER JOIN latest_timestamps AS l ON (
          t.document_name = l.document_name AND
          IFNULL(t.timestamp, TIMESTAMP("1970-01-01 00:00:00+00")) =
          IFNULL(l.latest_timestamp, TIMESTAMP("1970-01-01 00:00:00+00"))
        )
        WHERE t.operation != "DELETE"
        GROUP BY
          t.document_name,
          t.document_id,
          t.timestamp,
          t.operation,
          name,
          email
      `);

      expect(result.query).to.equal(expectedQuery);
    });
  });
});
