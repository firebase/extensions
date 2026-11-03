/**
 * Copyright 2026 Google LLC
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
      } catch (ex) {}
    }, 500);
  });
};
