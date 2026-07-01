import { BigQuery, Table } from "@google-cloud/bigquery";

export const setupBQ = async (
  datasetId: string,
  tableId: string,
  data: any
) => {
  const bq = new BigQuery({ projectId: "dev-extensions-testing" });

  const dataset = bq.dataset(datasetId);
  const exists = await dataset.exists();
  if (!exists[0]) {
    await dataset.create();
  }

  const schema = [
    {
      name: "document_name",
      type: "STRING",
      mode: "NULLABLE",
    },
    {
      name: "document_id",
      type: "STRING",
      mode: "NULLABLE",
    },
    {
      name: "timestamp",
      type: "TIMESTAMP",
      mode: "NULLABLE",
    },

    {
      name: "event_id",
      type: "STRING",
      mode: "NULLABLE",
    },
    {
      name: "operation",
      type: "STRING",
      mode: "NULLABLE",
    },
    {
      name: "data",
      type: "STRING",
      mode: "NULLABLE",
    },
  ];

  /** create a changelog table with a random name */
  const [rawChangeLogTable] = await dataset.createTable(
    `${tableId}_raw_changelog`,
    { schema }
  );

  const [rawLatestTable] = await dataset.createTable(`${tableId}_raw_latest`, {
    schema,
  });

  /** Insert data into both tables */
  const testData = {
    document_name: "test",
    document_id: "test",
    timestamp: new Date(),
    data: JSON.stringify(data),
    operation: "INSERT",
  };

  await rawChangeLogTable.insert(testData);
  await rawLatestTable.insert(testData);

  return { dataset, rawChangeLogTable, rawLatestTable };
};

export const randomId = () => {
  return Math.random().toString(36).substring(7);
};

export const getQueryResult = async (
  datasetId: string,
  tableId: string,
  schemaName: string
) => {
  const bq = new BigQuery({ projectId: "dev-extensions-testing" });

  /** Check that the view was generated */
  const [view] = await bq
    .dataset(datasetId)
    .table(`${tableId}_schema_${schemaName}_changelog`)
    .get();
  expect(view).toBeDefined();

  /** Get the view query */
  const viewQuery = view.metadata.view.query;

  /** Execute the query */
  const [queryResult] = await bq.query(viewQuery);

  return queryResult;
};

export const verifySetupBQ = async (
  datasetId: string,
  tableId: string,
  expectedData: any
) => {
  const bq = new BigQuery({ projectId: "dev-extensions-testing" });
  const dataset = bq.dataset(datasetId);
  const results = {
    success: true,
    errors: [],
    datasetExists: false,
    changelogTableExists: false,
    latestTableExists: false,
    changelogData: null,
    latestData: null,
  };

  try {
    // Check if dataset exists
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) {
      results.success = false;
      results.errors.push(`Dataset ${datasetId} does not exist`);
      return results;
    }
    results.datasetExists = true;

    // Check if tables exist
    const changelogTableId = `${tableId}_raw_changelog`;
    const latestTableId = `${tableId}_raw_latest`;

    const [changelogTableExists] = await dataset
      .table(changelogTableId)
      .exists();
    const [latestTableExists] = await dataset.table(latestTableId).exists();

    if (!changelogTableExists) {
      results.success = false;
      results.errors.push(`Changelog table ${changelogTableId} does not exist`);
    } else {
      results.changelogTableExists = true;
    }

    if (!latestTableExists) {
      results.success = false;
      results.errors.push(`Latest table ${latestTableId} does not exist`);
    } else {
      results.latestTableExists = true;
    }

    // If tables don't exist, no need to check data
    if (!changelogTableExists || !latestTableExists) {
      return results;
    }

    // Query tables to verify data was inserted
    const [changelogRows] = await bq.query(`
      SELECT * FROM \`${datasetId}.${changelogTableId}\`
      WHERE document_id = 'test'
    `);

    const [latestRows] = await bq.query(`
      SELECT * FROM \`${datasetId}.${latestTableId}\`
      WHERE document_id = 'test'
    `);

    // Verify data exists in both tables
    if (changelogRows.length === 0) {
      results.success = false;
      results.errors.push(
        `No data found in changelog table ${changelogTableId}`
      );
    } else {
      results.changelogData = changelogRows[0];

      // Check if data matches expected
      try {
        const parsedData = JSON.parse(changelogRows[0].data);
        const dataMatches =
          JSON.stringify(parsedData) === JSON.stringify(expectedData);

        if (!dataMatches) {
          results.success = false;
          results.errors.push(
            `Data in changelog table doesn't match expected data`
          );
        }
      } catch (e) {
        results.success = false;
        results.errors.push(
          `Failed to parse data in changelog table: ${e.message}`
        );
      }
    }

    if (latestRows.length === 0) {
      results.success = false;
      results.errors.push(`No data found in latest table ${latestTableId}`);
    } else {
      results.latestData = latestRows[0];

      // Check if data matches expected
      try {
        const parsedData = JSON.parse(latestRows[0].data);
        const dataMatches =
          JSON.stringify(parsedData) === JSON.stringify(expectedData);

        if (!dataMatches) {
          results.success = false;
          results.errors.push(
            `Data in latest table doesn't match expected data`
          );
        }
      } catch (e) {
        results.success = false;
        results.errors.push(
          `Failed to parse data in latest table: ${e.message}`
        );
      }
    }

    return results;
  } catch (error) {
    results.success = false;
    results.errors.push(`Verification failed with error: ${error.message}`);
    return results;
  }
};
