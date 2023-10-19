import { BigQuery } from "@google-cloud/bigquery";
import { CliConfig } from "./types";
import { FirestoreBigQueryEventHistoryTracker } from "@firebaseextensions/firestore-bigquery-change-tracker";

// TODO: do we need this logic?
export const initializeDataSink = async (
  dataSink: FirestoreBigQueryEventHistoryTracker,
  config: CliConfig
) => {
  const bigquery = new BigQuery();
  const dataset = bigquery.dataset(config.datasetId);
  const table = dataset.table(config.rawChangeLogName);
  const [tableExists] = await table.exists();
  await dataSink.initialize();
  if (!tableExists) {
    console.log("Wait a few seconds for the dataset to initialize...");
    await new Promise((resolve) => setTimeout(resolve, 5000, [])); // Wait for the dataset to initialize
  }
};
