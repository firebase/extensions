/*
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// deleteDatasets.js
const { BigQuery } = require("@google-cloud/bigquery");

// Create a BigQuery client for the specified project.
const bq = new BigQuery({ projectId: "dev-extensions-testing" });

async function deleteAllDatasets() {
  try {
    // List all datasets in the project.
    const [datasets] = await bq.getDatasets();
    console.log(`Found ${datasets.length} datasets.`);

    // Iterate over each dataset and delete it.
    for (const dataset of datasets) {
      if (dataset.id !== "2025_stress_test") {
        console.log(`Deleting dataset: ${dataset.id}...`);
        // The force option will delete the dataset along with all its tables.
        await dataset.delete({ force: true });
        console.log(`Dataset ${dataset.id} deleted successfully.`);
      }
    }

    console.log("All datasets have been deleted.");
  } catch (error) {
    console.error("Error deleting datasets:", error);
  }
}

// Execute the deletion function.
deleteAllDatasets();
