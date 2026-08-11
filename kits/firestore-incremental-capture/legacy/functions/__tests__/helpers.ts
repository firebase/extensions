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

import { DocumentReference, DocumentSnapshot } from "firebase-admin/firestore";
import { WrappedFirebaseFunction } from "./types";
import { FeaturesList } from "firebase-functions-test/lib/features";

const { BigQuery } = require("@google-cloud/bigquery");
const bq = new BigQuery({ projectId: "dev-extensions-testing" });

export const simulateFunctionTriggered =
  (
    module: FeaturesList,
    wrappedFunction: WrappedFirebaseFunction,
    collectionName: string
  ) =>
  async (ref: DocumentReference, before?: DocumentSnapshot) => {
    const data = (await ref.get()).data() as { [key: string]: any };
    const beforeFunctionExecution = module.firestore.makeDocumentSnapshot(
      data,
      `${collectionName}/${ref.id}`
    ) as DocumentSnapshot;
    const change = module.makeChange(before, beforeFunctionExecution);
    await wrappedFunction(change);
    return beforeFunctionExecution;
  };

export const clearBQTables = async () => {
  const [datasets] = await bq.getDatasets({
    projectId: "dev-extensions-testing",
  });

  for await (const dataset of datasets) {
    try {
      await dataset.delete({ force: true });
      console.log(`Dataset ${dataset.id} deleted.`);
    } catch (ex) {
      console.log((ex as Error).message);
    }
  }
};
