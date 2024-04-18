import { Dataset, Table } from "@google-cloud/bigquery";
import * as logs from "../../logs";

interface WaitForInitializationParams {
  dataset: Dataset;
  changelogName: string;
}

/**
 * Periodically checks for the existence of a dataset and table until both are found or a maximum number of attempts is reached.
 * @param {WaitForInitializationParams} params - Parameters for initialization including the dataset and the table name to check.
 * @param {number} maxAttempts - Maximum number of attempts before giving up (defaults to 12).
 * @returns {Promise<Table>} A promise that resolves with the Table if it exists, or rejects if it doesn't exist after maxAttempts or an error occurs.
 * @throws {Error} Throws an error if the dataset or table cannot be verified to exist after multiple attempts or if an unexpected error occurs.
 */
export async function waitForInitialization(
  { dataset, changelogName }: WaitForInitializationParams,
  maxAttempts = 12
): Promise<Table> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    let handle = setInterval(async () => {
      try {
        const [datasetExists] = await dataset.exists();
        const table = dataset.table(changelogName);
        const [tableExists] = await table.exists();

        if (datasetExists && tableExists) {
          clearInterval(handle);
          resolve(table);
        } else {
          attempts++;
          if (attempts >= maxAttempts) {
            clearInterval(handle);
            reject(
              new Error(
                "Initialization timed out. Dataset or table could not be verified to exist after multiple attempts."
              )
            );
          }
        }
      } catch (error) {
        clearInterval(handle);
        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred";
        logs.failedToInitializeWait(message);
        reject(new Error(message));
      }
    }, 500);
  });
}
