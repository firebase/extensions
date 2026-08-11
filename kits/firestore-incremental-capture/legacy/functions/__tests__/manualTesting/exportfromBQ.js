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

const { BigQuery } = require("@google-cloud/bigquery");

const bq = new BigQuery({ projectId: "dev-extensions-testing" });

(async () => {
  /** Get all the records from before  2023-08-22 13:23 */
  const query =
    "SELECT * FROM `dev-extensions-testing.syncData.syncData` WHERE timestamp < TIMESTAMP('2023-08-22 13:23:00')";

  /** Execute the query */
  await bq.query(query).then((data) => {
    console.log(data);
  });
})();
