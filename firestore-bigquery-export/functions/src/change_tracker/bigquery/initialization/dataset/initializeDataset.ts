import { Dataset } from "@google-cloud/bigquery";
import * as logs from "../../../logs";
import { parseErrorMessage } from "../../utils";

interface InitializeDatasetParams {
  dataset: Dataset;
}

/**
 * Initializes a BigQuery dataset if it doesn't already exist.
 * @param {InitializeDatasetParams} params - Contains the dataset object which is to be checked and possibly created.
 * @returns {Promise<Dataset>} Returns the dataset, whether it was newly created or already existed.
 * @throws {Error} Throws an error if there is an issue creating the dataset.
 */
export async function initializeDataset({
  dataset,
}: InitializeDatasetParams): Promise<Dataset> {
  try {
    const [datasetExists] = await dataset.exists();
    if (datasetExists) {
      logs.bigQueryDatasetExists(dataset.id);
      return dataset; // Directly return if exists, no further action needed.
    }

    // Proceed to create the dataset if it does not exist.
    logs.bigQueryDatasetCreating(dataset.id);
    await dataset.create();
    logs.bigQueryDatasetCreated(dataset.id);
    return dataset;
  } catch (error) {
    // Handle errors for both checking existence and creating the dataset.
    const message = parseErrorMessage(
      error,
      `initializing dataset ${dataset.id}`
    );
    logs.tableCreationError(dataset.id, message);
    throw new Error(message); // Throw a new error with the formatted message.
  }
}
