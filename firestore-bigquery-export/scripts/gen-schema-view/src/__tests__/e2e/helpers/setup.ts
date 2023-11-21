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
