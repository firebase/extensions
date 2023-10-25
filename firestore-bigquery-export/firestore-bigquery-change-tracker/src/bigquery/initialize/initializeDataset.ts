import { Dataset } from "@google-cloud/bigquery";
import * as logs from "../../logs";

/**
 * Creates the specified dataset if it doesn't already exists.
 */
export async function initializeDataset(dataset: Dataset): Promise<Dataset> {
  const [datasetExists] = await dataset.exists();
  if (datasetExists) {
    logs.bigQueryDatasetExists(dataset.id);
    return dataset;
  }
  try {
    logs.bigQueryDatasetCreating(dataset.id);
    await dataset.create();
    logs.bigQueryDatasetCreated(dataset.id);
  } catch (e) {
    logs.tableCreationError(dataset.id, e.message);
  }
  return dataset;
}
