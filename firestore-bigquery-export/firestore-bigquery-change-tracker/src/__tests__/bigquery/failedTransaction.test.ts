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
import { ChangeTrackerConfig } from "../../bigquery/types";

import handleFailedTransactions from "../../bigquery/handleFailedTransactions";

// admin.initializeApp();
const db = admin.firestore();

describe("handleFailedTransactions", () => {
  it("should be defined", () => {
    expect(handleFailedTransactions).toBeDefined();
  });

  it("should handle more than 500 records", async () => {
    const collectionName = "testing";
    const doc = db.collection("testing").doc("600");

    const config: ChangeTrackerConfig = {
      backupTableId: collectionName,
      datasetId: "",
      tableId: "",
      datasetLocation: "",
      transformFunction: undefined,
      partitioning: {
        granularity: "NONE",
      },
      clustering: undefined,
      bqProjectId: undefined,
    };

    const rows = Array.from(Array(700).keys()).map((x) => {
      return {
        insertId: x.toString(),
      };
    });

    handleFailedTransactions(rows, config, Error("example_error"));

    return new Promise((resolve, reject) => {
      const unsubscribe = doc.onSnapshot((snapshot) => {
        const document = snapshot.data();

        if (document && document.error_details) {
          expect(document.error_details).toEqual("example_error");
          unsubscribe();
          resolve(true);
        }
      });
    });
  });
});
