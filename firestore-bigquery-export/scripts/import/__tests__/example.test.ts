import { BigQuery } from "@google-cloud/bigquery";

import * as childProcess from "child_process";
import * as path from "path";
import * as admin from "firebase-admin";
import { repeat } from "./helpers/waitFor";

const scriptPath = path.join(__dirname, "../lib/index.js");
const projectId = "extensions-testing";

const bigquery = new BigQuery({ projectId });

async function runScript(scriptPath, callback, args?: string[]) {
  return new Promise<void>((resolve, reject) => {
    // keep track of whether callback has been invoked to prevent multiple invocations
    let invoked = false;
    const child = childProcess.fork(scriptPath, args, {
      cwd: __dirname,
      stdio: [process.stdin, process.stdout, process.stderr, "ipc"],
      env: {
        ...process.env,
      },
    });

    // listen for errors as they may prevent the exit event from firing
    child.on("error", (err) => {
      if (invoked) return;
      invoked = true;
      callback(err);
      reject(err);
    });

    // execute the callback once the process has finished running
    child.on("exit", (code) => {
      if (invoked) return;
      invoked = true;
      const err = code === 0 ? null : new Error("exit code " + code);
      callback(err);
      resolve();
    });
  });
}

describe("CLI", () => {
  let firestore;
  let collectionName = "testCollection";
  let datasetName = "testDataset";
  const tableName = "testTable";

  const randomID = Math.random().toString(36).substring(7);

  beforeEach(async () => {
    collectionName = `testCollection_${randomID}`;
    datasetName = `testDataset_${randomID}`;

    //This is live config, should be emulator?
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
    process.env.FIREBASE_CONFIG = JSON.stringify({
      apiKey: "AIzaSyAJTgFI-OVRjgd_10JDWc9T3kxvxY-fUe4",
      authDomain: "extensions-testing.firebaseapp.com",
      databaseURL: "https://extensions-testing.firebaseio.com",
      projectId: "extensions-testing",
      storageBucket: "extensions-testing.appspot.com",
      messagingSenderId: "219368645393",
      appId: "1:219368645393:web:e92083eba0c53f366862b0",
      measurementId: "G-QF38ZM1SZN",
    });
    // if there is no app, initialize one
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    firestore = admin.firestore();
    await firestore
      .collection(collectionName)
      .doc("test")
      .set({ test: "test" });
  });

  afterEach(async () => {
    // we don't need this, will reset on emulator closing?
    // if ((await firestore.collection(collectionName).get()).size > 0) {
    // await firestore.collection(collectionName).delete();
    // }

    // if dataset exists, delete it
    if ((await bigquery.dataset(datasetName).exists())[0]) {
      await bigquery.dataset(datasetName).delete({ force: true });
    }
  });

  test(`my test`, async () => {
    const args = [
      "--non-interactive",
      "-P",
      "extensions-testing",
      "-u",
      "-s",
      collectionName,
      "-d",
      datasetName,
      "-t",
      tableName,
      "-q",
      "false",
      "-l",
      "us",
      "-u",
      "-e",
    ];

    await runScript(
      scriptPath,
      () => {
        console.log("complete!");
      },
      args
    );

    // sleep for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 10000));

    const rows = await repeat(
      () => bigquery.dataset(datasetName).table(tableName).getRows(),
      (rows) => rows.length > 0,
      10
    );

    const {
      operation,
      timestamp,
      document_name,
      document_id,
      data,
      event_id,
      old_data,
    } = rows[0];

    expect(operation).toBe("IMPORT");
    expect(document_name).toBe(
      "projects/extensions-testing/databases/(default)/documents/testCollection/test"
    );
    expect(document_id).toBe("test");
    expect(JSON.parse(data)).toEqual({ test: "test" });
    expect(event_id).toBe("");
    expect(old_data).toBeNull();

    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
    // delete the bigquery table test_table_jacob_1
  });
});
