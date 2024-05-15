import { BigQuery } from "@google-cloud/bigquery";
import { getQueryResult, randomId, setupBQ } from "./helpers/setup";
import executeScript from "./helpers/executeScript";

const bq = new BigQuery({ projectId: "extensions-testing" });

const datasetPrefix = "e2e_test_";

describe("e2e", () => {
  beforeEach(async () => {
    /** Clear all bq datasets starting with test_ */
    const [datasets] = await bq.getDatasets();

    const testDatasets = datasets.filter((d) => d.id.startsWith(datasetPrefix));

    for (const dataset of testDatasets) {
      console.log("Deleting dataset: ", dataset.id);
      await dataset.delete({ force: true });
    }
  });

  test("should generate a schame view based on a basic dataset and schema", async () => {
    /** Set the schema to be tested */
    const schemaName = "basic";

    /** Create the test for the db */
    const testData = {
      name: "test",
    };

    /** Generate Id */
    const id = randomId();

    /** Set the dataset and table names */
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

    /** Create dataset and table */
    const { dataset, rawChangeLogTable, rawLatestTable } = await setupBQ(
      datasetId,
      tableId,
      testData
    );

    console.log("Testing with dataset: ", dataset.id);
    console.log("Testing with table: ", rawChangeLogTable.id);
    console.log("Testing with table: ", rawLatestTable.id);

    /** await 5 seconds for the table to propogate */
    await new Promise((resolve) => setTimeout(resolve, 5000));

    /** Run the gen-schema script */
    await executeScript(dataset.id, tableId, schemaName);

    console.log("Done executing");

    /* wait 10 seconds for the view to propogate */
    await new Promise((resolve) => setTimeout(resolve, 10000));

    /** Get the query result */
    const result = await getQueryResult(dataset.id, tableId, schemaName);

    /** Assert data */
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("test");
  }, 80000);

  test("should generate a schame view based on a nestedMapSchema dataset and schema", async () => {
    /** Set the schema to be tested */
    const schemaName = "nestedMapSchema";

    /** Create the test for the db */
    const testData = {
      super: {
        nested: {
          schema: {
            value: 1,
          },
        },
      },
    };

    /** Generate Id */
    const id = randomId();

    /** Set the dataset and table names */
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

    /** Create dataset and table */
    const { dataset, rawChangeLogTable, rawLatestTable } = await setupBQ(
      datasetId,
      tableId,
      testData
    );

    console.log("Testing with dataset: ", dataset.id);
    console.log("Testing with table: ", rawChangeLogTable.id);
    console.log("Testing with table: ", rawLatestTable.id);

    /** await 5 seconds for the table to propogate */
    await new Promise((resolve) => setTimeout(resolve, 5000));

    /** Run the gen-schema script */
    await executeScript(dataset.id, tableId, schemaName);

    console.log("Done executing");

    /* wait 10 seconds for the view to propogate */
    await new Promise((resolve) => setTimeout(resolve, 10000));

    /** Get the query result */
    const result = await getQueryResult(dataset.id, tableId, schemaName);

    /** Assert data */
    expect(result.length).toBe(1);

    expect(result[0].super_nested_schema_value.toString()).toBe("1");
  }, 80000);

  test("should generate a schame view based on a arraysNestedInMapsSchema dataset and schema", async () => {
    /** Set the schema to be tested */
    const schemaName = "arraysNestedInMapsSchema";

    /** Create the test for the db */
    const testData = {
      map: {
        array: [],
      },
      map2: {
        array: [],
      },
    };

    /** Generate Id */
    const id = randomId();

    /** Set the dataset and table names */
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

    /** Create dataset and table */
    const { dataset, rawChangeLogTable, rawLatestTable } = await setupBQ(
      datasetId,
      tableId,
      testData
    );

    console.log("Testing with dataset: ", dataset.id);
    console.log("Testing with table: ", rawChangeLogTable.id);
    console.log("Testing with table: ", rawLatestTable.id);

    /** await 5 seconds for the table to propogate */
    await new Promise((resolve) => setTimeout(resolve, 5000));

    /** Run the gen-schema script */
    await executeScript(dataset.id, tableId, schemaName);

    console.log("Done executing");

    /* wait 10 seconds for the view to propogate */
    await new Promise((resolve) => setTimeout(resolve, 10000));

    /** Get the query result */
    const result = await getQueryResult(dataset.id, tableId, schemaName);

    /** Assert data */
    expect(result.length).toBe(1);

    console.log("result: ", result[0]);
    console.log("result: ", result[0].map_array);

    expect(JSON.stringify(result[0].map_array)).toBe(JSON.stringify([]));
    expect(JSON.stringify(result[0].map2_array)).toBe(JSON.stringify([]));
    expect(result[0].map_array_member).toBeNull();
    expect(result[0].map_array_index).toBeNull();
    expect(result[0].map2_array_member).toBeNull();
    expect(result[0].map2_array_index).toBeNull();
  }, 80000);

  test("should generate a schame view based on a mappedArray dataset and schema", async () => {
    /** Set the schema to be tested */
    const schemaName = "mappedArray";

    /** Create the test for the db */
    const testData = {
      name: "test",
      date: new Date(),
      total: 1,
      cartItems: [
        {
          productName: "test",
          quantity: "test",
          isGift: "Yes",
        },
      ],
    };

    /** Generate Id */
    const id = randomId();

    /** Set the dataset and table names */
    const datasetId = `${datasetPrefix}${id}`;
    const tableId = `table_${id}`;

    /** Create dataset and table */
    const { dataset, rawChangeLogTable, rawLatestTable } = await setupBQ(
      datasetId,
      tableId,
      testData
    );

    console.log("Testing with dataset: ", dataset.id);
    console.log("Testing with table: ", rawChangeLogTable.id);
    console.log("Testing with table: ", rawLatestTable.id);

    /** await 5 seconds for the table to propogate */
    await new Promise((resolve) => setTimeout(resolve, 5000));

    /** Run the gen-schema script */
    await executeScript(dataset.id, tableId, schemaName);

    console.log("Done executing");

    /* wait 10 seconds for the view to propogate */
    await new Promise((resolve) => setTimeout(resolve, 10000));

    /** Get the query result */
    const result = await getQueryResult(dataset.id, tableId, schemaName);

    /** Assert data */
    expect(result.length).toBe(1);

    console.log("result: ", result[0]);
    console.log("result: ", result[0].map_array);

    expect(result[0].productName).toBe("test");
    expect(result[0].quantity).toBe("test");
    expect(result[0].isGift).toBe("Yes");
    expect(result[0].total).toBe("1");
  }, 80000);
});
