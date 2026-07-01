import { BigQuery } from "@google-cloud/bigquery";

export const defaultQuery = (
  bqProjectId: string,
  datasetId: string,
  tableId: string
): string => `SELECT *
      FROM \`${bqProjectId}.${datasetId}.${tableId}\`
      LIMIT 1`;

export const getBigQueryTableData = async (bqProjectId, datasetId, tableId) => {
  const bq = new BigQuery({ projectId: bqProjectId });

  // Setup queries
  const [changeLogQuery] = await bq.createQueryJob({
    query: defaultQuery(bqProjectId, datasetId, `${tableId}_raw_changelog`),
  });

  const [latestViewQuery] = await bq.createQueryJob({
    query: defaultQuery(bqProjectId, datasetId, `${tableId}_raw_latest`),
  });

  // // Wait for the queries to finish
  const [changeLogRows] = await changeLogQuery.getQueryResults();
  const [latestRows] = await latestViewQuery.getQueryResults();

  return [changeLogRows, latestRows];
};
