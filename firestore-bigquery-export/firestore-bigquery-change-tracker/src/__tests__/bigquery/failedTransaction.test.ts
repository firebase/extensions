import * as admin from "firebase-admin";
import { FirestoreBigQueryEventHistoryTrackerConfig } from "../../bigquery";

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

    const config: FirestoreBigQueryEventHistoryTrackerConfig = {
      backupTableId: collectionName,
      datasetId: "",
      tableId: "",
      datasetLocation: "",
      transformFunction: undefined,
      timePartitioning: undefined,
      timePartitioningField: undefined,
      timePartitioningFieldType: undefined,
      timePartitioningFirestoreField: undefined,
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
