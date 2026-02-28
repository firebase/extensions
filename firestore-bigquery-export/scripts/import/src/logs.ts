import { CliConfig } from "./types";

export const finishedImporting = (rowCount: number) => {
  console.log("---------------------------------------------------------");
  console.log(`Finished importing ${rowCount} Firestore rows to BigQuery`);
  console.log("---------------------------------------------------------");
};

export const errorImporting = (error: unknown) => {
  console.error(`Error importing Collection to BigQuery: ${error.toString()}`);
};

export const warningUnlinkingJournalFile = (
  cursorPositionFile: string,
  e: unknown
) => {
  console.warn(e);
  console.warn(
    `Error unlinking journal file ${cursorPositionFile} after successful import: ${e.toString()}`
  );
};

export const importingData = (config: CliConfig) => {
  console.log(
    `Importing data from Cloud Firestore Collection${
      config.queryCollectionGroup ? " (via a Collection Group query)" : ""
    }: ${config.sourceCollectionPath}, to BigQuery Dataset: ${
      config.datasetId
    }, Table: ${config.rawChangeLogName}`
  );
};

export const waitingToInitialize = () => {
  console.log("Wait a few seconds for the dataset to initialize...");
};

export const finishedImportingParallel = (
  config: CliConfig,
  total: number,
  partitions: number
) => {
  console.log(`Imported ${total} documents in ${partitions} partitions.`);

  console.log("---------------------------------------------------------");
  console.log(
    `Please see https://console.cloud.google.com/bigquery?p=${config.bigQueryProjectId}&d=${config.datasetId}&t=${config.tableId}_raw_changelog&page=table`
  );
  console.log("---------------------------------------------------------");
};

export const resumingImport = (config: CliConfig, cursorDocumentId: string) => {
  console.log(
    `Resuming import of Cloud Firestore Collection ${
      config.sourceCollectionPath
    } ${
      config.queryCollectionGroup ? " (via a Collection Group query)" : ""
    } from document ${cursorDocumentId}.`
  );
};

export const warningMultiThreadedCollectionGroupOnly = () => {
  console.warn(
    "Multi-threaded imports are only supported for Collection Group queries. Proceeding with a single thread."
  );
};
