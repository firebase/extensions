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

import * as admin from "firebase-admin";

export const waitForFile = async (
  storage: admin.storage.Storage,
  filePath: string,
  timeout: number = 1000,
  maxAttempts: number = 20
) => {
  let exists: [boolean];

  const promise = new Promise((resolve, reject) => {
    let timesRun = 0;
    const interval = setInterval(async () => {
      timesRun += 1;
      try {
        exists = await storage.bucket().file(filePath).exists();
      } catch (e) {}
      if (exists && exists[0]) {
        clearInterval(interval);
        resolve(exists[0]);
      }
      if (timesRun > maxAttempts) {
        clearInterval(interval);
        reject("timed out without finding file " + filePath);
      }
    }, timeout);
  });

  return await promise;
};
