/**
 * Copyright 2023 Google LLC
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

import { logger } from "firebase-functions";

import config from "../config";
import { getTable } from "../utils/big_query";

export async function syncDataTaskHandler(
  data: Record<any, any>
): Promise<void> {
  const table = await getTable(config.bqDataset, config.bqtable);

  // Write the data to the database
  await table.insert(data).catch((ex: any) => {
    for (const error of ex.errors) {
      for (const err of error.errors) {
        logger.error(err);
      }
    }
  });
}
