/*
 * Copyright 2019 Google LLC
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

import * as functions from "firebase-functions";

import config from "./config";
import * as logs from "./logs";

logs.init();

export const rtdblimit = functions.database
  .ref(config.databaseInstance)
  .onCreate(async (snapshot): Promise<void> => {
    logs.start();

    try {
      const parentRef = snapshot.ref.parent;
      const parentSnapshot = await parentRef.once("value");

      /** set reference for logging */
      const reference = snapshot.ref
        .toString()
        .substring(snapshot.ref.root.toString().length - 1);

      logs.childCount(reference, parentSnapshot.numChildren());

      if (parentSnapshot.numChildren() > config.maxCount) {
        let childCount = 0;
        const updates = {};
        parentSnapshot.forEach((child) => {
          if (++childCount <= parentSnapshot.numChildren() - config.maxCount) {
            updates[child.key] = null;
          }
        });

        logs.pathTruncating(reference, config.maxCount);
        await parentRef.update(updates);
        logs.pathTruncated(reference, config.maxCount);
      } else {
        logs.pathSkipped(reference);
      }

      logs.complete();
    } catch (err) {
      logs.error(err);
    }
  });
