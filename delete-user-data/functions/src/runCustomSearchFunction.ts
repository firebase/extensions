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

import { runBatchPubSubDeletions } from "./runBatchPubSubDeletions";
import * as logs from "./logs";
import config from "./config";

export const runCustomSearchFunction = async (uid: string): Promise<void> => {
  const response = await fetch(config.searchFunction, {
    method: "POST",
    body: JSON.stringify({ uid }),
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    logs.customFunctionError(new Error(body));
    return;
  }

  /** Get user resonse **/
  const json = await response.json();

  // Support returning an array directly
  if (Array.isArray(json)) {
    return runBatchPubSubDeletions({ firestorePaths: json }, uid);
  }

  return runBatchPubSubDeletions(json, uid);
};
