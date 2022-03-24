import { BigQuery } from "@google-cloud/bigquery";

export const getTableDataColumns = async (
  bqProjectId,
  datasetId,
  tableId,
  column_name
) => {
  const bq = new BigQuery();

  const [latest_metadata] = await bq
    .dataset(bqProjectId)
    .table(`${tableId}_raw_changelog`)
    .getMetadata();

  const latest_dataColumn = latest_metadata.schema.fields.filter(
    ($) => $.name === column_name
  )[0];

  const [changelog_metadata] = await bq
    .dataset(datasetId)
    .table(`${tableId}_raw_latest`)
    .getMetadata();

  const changelog_dataColumn = changelog_metadata.schema.fields.filter(
    ($) => $.name === column_name
  )[0];

  return [latest_dataColumn, changelog_dataColumn];
};
