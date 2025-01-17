import { BigQuery } from "@google-cloud/bigquery";

export const deleteTable = async ({
  projectId = "dev-extensions-testing",
  datasetId = "",
}) => {
  const bq = new BigQuery({ projectId });
  return new Promise((resolve) => {
    const dataset = bq.dataset(datasetId);

    let handle = setInterval(async () => {
      const [datasetExists] = await dataset.exists();

      if (!datasetExists) {
        clearInterval(handle);
        return resolve(dataset);
      }

      try {
        if (datasetExists) {
          await dataset.delete({ force: true });
        }
      } catch (ex) {
        console.warn(`Attempted to clear ${datasetId}`, ex.message);
      }
    }, 500);
  });
};
