import * as admin from "firebase-admin";
import { BigQuery } from "@google-cloud/bigquery";

/** Set defaults */
const bqProjectId = process.env.BQ_PROJECT_ID || "dev-extensions-testing";
const datasetId = process.env.DATASET_ID || "firestore_export";
const tableId = process.env.TABLE_ID || "bq_e2e_test_raw_changelog";

/** Init resources */
admin.initializeApp({ projectId: bqProjectId });
const bq = new BigQuery({
  projectId: "dev-extensions-testing",
  // location: "us-central1",
});
import { documentData } from "./fixtures/documentData";

/***
 * Must have a current installed version of the extension to run this test.
 * named firestore-bigquery-export
 * dataset: firestore_export
 * table: bq_e2e_test
 */

describe("e2e", () => {
  test("successfully syncs a document", async () => {
    const db = admin.firestore();
    const testData = await documentData();

    /** Create an object that has every data type for firestore */
    const docRef = await db.collection("posts").add(testData);

    /** Wait for 20 seconds */
    await new Promise((resolve) => setTimeout(resolve, 20000));

    /** Get the latest record from this table */
    const [changeLogQuery] = await bq.createQueryJob({
      query: `SELECT * FROM \`${bqProjectId}.${datasetId}.${tableId}\` ORDER BY timestamp DESC LIMIT 1`,
    });

    const [rows] = await changeLogQuery.getQueryResults();

    /** Check that the row matches the expected data */
    const { document_id, data } = rows[0];
    const result = JSON.parse(data);

    // Check the document ID
    expect(document_id).toBe(docRef.id);

    // Check the data
    expect(result.a_string).toBe("a_string_value");
    expect(result.an_integer).toBe(30);
    expect(result.a_boolean).toBe(true);
    expect(result.a_list).toEqual([
      "a_string_value",
      "b_string_value",
      "c_string_value",
    ]);
    expect(result.a_date._seconds).toBe(1692425558);
    expect(result.a_date._nanoseconds).toBe(0);
    expect(result.singleReference).toBe("reference/reference1");
    expect(result.reference_list[0]).toBe("reference/reference1");
    expect(result.reference_list[1]).toBe("reference/reference2");
  }, 30000);
});
