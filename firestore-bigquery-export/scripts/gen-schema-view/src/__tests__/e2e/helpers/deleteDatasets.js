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
