import { BigQuery } from "@google-cloud/bigquery";

import * as childProcess from "child_process";
import * as path from "path";
import * as admin from "firebase-admin";
import { repeat } from "./helpers/waitFor";
import axios from "axios";

const scriptPath = path.join(__dirname, "../lib/index.js");
const projectId = "extensions-testing";

const bigquery = new BigQuery({ projectId });

async function runScript(scriptPath: string, callback, args?: string[]) {
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

describe("e2e test CLI", () => {
  let firestore;
  let collectionName = "testCollection";
  let datasetName = "testDataset";
  let tableName = "testTable";

  beforeEach(async () => {
    const randomID = Math.random().toString(36).substring(7);
    collectionName = `testCollection_${randomID}`;
    datasetName = `testDataset_${randomID}`;
    tableName = `testTable_${randomID}`;

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
    // if dataset exists, delete it
    // if ((await bigquery.dataset(datasetName).exists())[0]) {
    //   await bigquery.dataset(datasetName).delete({ force: true });
    // }
    // delete all data from firestore via axios request
    // await axios.delete(
    //   `http://localhost:8080/emulator/v1/projects/extensions-testing/databases/(default)/documents`,
    // )
  });

  test(`should import data with old script`, async () => {
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
      "-e",
      "true",
    ];

    await runScript(
      scriptPath,
      () => {
        console.log("complete!");
      },
      args
    );

    const [rows] = await repeat(
      () =>
        bigquery
          .dataset(datasetName)
          .table(`${tableName}_raw_changelog`)
          .getRows(),
      (rows) => rows[0].length > 0,
      10,
      20000
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
      `projects/extensions-testing/databases/(default)/documents/${collectionName}/test`
    );
    expect(document_id).toBe("test");
    expect(JSON.parse(data)).toEqual({ test: "test" });
    expect(event_id).toBe("");
    expect(old_data).toBeNull();
    expect(timestamp).toBeDefined();
  });
  test(`should import data with new script, and add the correct view`, async () => {
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
      "true",
      "-e",
      "true",
    ];

    await runScript(
      scriptPath,
      () => {
        console.log("complete!");
      },
      args
    );

    const [rows] = await repeat(
      () =>
        bigquery
          .dataset(datasetName)
          .table(`${tableName}_raw_changelog`)
          .getRows(),
      (rows) => rows[0].length > 0,
      10,
      20000
    );

    expect(rows.length).toBeGreaterThanOrEqual(1);
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
      `projects/extensions-testing/databases/(default)/documents/${collectionName}/test`
    );
    expect(document_id).toBe("test");
    expect(JSON.parse(data)).toEqual({ test: "test" });

    expect(event_id).toBe("");
    expect(old_data).toBeNull();
    expect(timestamp).toBeDefined();

    const [view] = await bigquery
      .dataset(datasetName)
      .table(`${tableName}_raw_latest`)
      .get();

    const query = view.metadata.view.query;
    expect(query).toBeDefined();
    const isOldQuery = query.includes("FIRST_VALUE");
    expect(isOldQuery).toBe(false);
  });

  test("basic collection group query", async () => {
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
    // if there is no app, initialize one
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    firestore = admin.firestore();

    await firestore
      .collection("regions/europe/countries")
      .doc("france")
      .set({ name: "France" });

    await firestore
      .collection("notregions/asia/countries")
      .doc("japan")
      .set({ name: "Japan" });

    const args = [
      "--non-interactive",
      "-P",
      "extensions-testing",
      "-u",
      "-s",
      "countries",
      "-d",
      datasetName,
      "-t",
      tableName,
      "-q",
      "true",
      "-l",
      "us",
      "-u",
      "true",
      "-e",
      "true",
    ];

    await runScript(
      scriptPath,
      () => {
        console.log("complete!");
      },
      args
    );

    console.log(datasetName);

    const [rows] = await repeat(
      () =>
        bigquery
          .dataset(datasetName)
          .table(`${tableName}_raw_changelog`)
          .getRows(),
      (rows) => rows[0].length > 1,
      10,
      20000
    );

    console.log(rows);
    expect(rows.length).toBe(2);

    const { operation, timestamp, event_id, old_data } = rows[0];

    expect(operation).toBe("IMPORT");
    // expect(document_name).toBe(
    //   `projects/extensions-testing/databases/(default)/documents/${collectionName}/test`
    // );
    // expect(document_id).toBe("test");
    // expect(JSON.parse(data)).toEqual({ test: "test" });

    expect(event_id).toBe("");
    expect(old_data).toBeNull();
    expect(timestamp).toBeDefined();

    const [view] = await bigquery
      .dataset(datasetName)
      .table(`${tableName}_raw_latest`)
      .get();

    const query = view.metadata.view.query;
    expect(query).toBeDefined();
    const isOldQuery = query.includes("FIRST_VALUE");
    expect(isOldQuery).toBe(false);
  });

  test("wildcarded collection group query", async () => {
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
      .collection("regions/europe/countries")
      .doc("france")
      .set({ name: "France" });

    await firestore
      .collection("regions/asia/countries")
      .doc("japan")
      .set({ name: "Japan" });

    const args = [
      "--non-interactive",
      "-P",
      "extensions-testing",
      "-u",
      "-s",
      "regions/{regionId}/countries",
      "-d",
      datasetName,
      "-t",
      tableName,
      "-q",
      "true",
      "-l",
      "us",
      "-u",
      "true",
      "-e",
      "true",
    ];

    await runScript(
      scriptPath,
      () => {
        console.log("complete!");
      },
      args
    );

    console.log(datasetName);

    const [rows] = await repeat(
      () =>
        bigquery
          .dataset(datasetName)
          .table(`${tableName}_raw_changelog`)
          .getRows(),
      (rows) => rows[0].length > 1,
      10,
      20000
    );

    expect(rows.length).toBe(2);
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
    // expect(document_name).toBe(
    //   `projects/extensions-testing/databases/(default)/documents/${collectionName}/test`
    // );
    // expect(document_id).toBe("test");
    // expect(JSON.parse(data)).toEqual({ test: "test" });

    expect(event_id).toBe("");
    expect(old_data).toBeNull();
    expect(timestamp).toBeDefined();

    const [view] = await bigquery
      .dataset(datasetName)
      .table(`${tableName}_raw_latest`)
      .get();

    const query = view.metadata.view.query;
    expect(query).toBeDefined();
    const isOldQuery = query.includes("FIRST_VALUE");
    expect(isOldQuery).toBe(false);
  });
  test("shouldn't export non-matching results from collection group query", async () => {
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
      .collection("regions/europe/countries")
      .doc("france")
      .set({ name: "France" });

    await firestore
      .collection("regions/asia/countries")
      .doc("japan")
      .set({ name: "Japan" });

    await firestore
      .collection("notregions/asia/countries")
      .doc("foo")
      .set({ name: "Bar" });

    const args = [
      "--non-interactive",
      "-P",
      "extensions-testing",
      "-u",
      "-s",
      "regions/{regionId}/countries",
      "-d",
      datasetName,
      "-t",
      tableName,
      "-q",
      "true",
      "-l",
      "us",
      "-u",
      "true",
      "-e",
      "true",
    ];

    await runScript(
      scriptPath,
      () => {
        console.log("complete!");
      },
      args
    );
    //sleep for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log(datasetName);

    const [rows] = await repeat(
      () =>
        bigquery
          .dataset(datasetName)
          .table(`${tableName}_raw_changelog`)
          .getRows(),
      (rows) => rows[0].length > 1,
      10,
      20000
    );

    expect(rows.length).toBe(2);
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
    // expect(document_name).toBe(
    //   `projects/extensions-testing/databases/(default)/documents/${collectionName}/test`
    // );
    // expect(document_id).toBe("test");
    // expect(JSON.parse(data)).toEqual({ test: "test" });

    expect(event_id).toBe("");
    expect(old_data).toBeNull();
    expect(timestamp).toBeDefined();

    const [view] = await bigquery
      .dataset(datasetName)
      .table(`${tableName}_raw_latest`)
      .get();

    const query = view.metadata.view.query;
    expect(query).toBeDefined();
    const isOldQuery = query.includes("FIRST_VALUE");
    expect(isOldQuery).toBe(false);
  });

  test("should match several wildcards in one query", async () => {
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
      .collection("regions/europe/countries/france/cities")
      .doc("paris")
      .set({ name: "Paris" });

    const args = [
      "--non-interactive",
      "-P",
      "extensions-testing",
      "-u",
      "-s",
      "regions/{regionId}/countries/{countryId}/cities",
      "-d",
      datasetName,
      "-t",
      tableName,
      "-q",
      "true",
      "-l",
      "us",
      "-u",
      "true",
      "-e",
      "true",
    ];

    await runScript(
      scriptPath,
      () => {
        console.log("complete!");
      },
      args
    );

    const [rows] = await repeat(
      () =>
        bigquery
          .dataset(datasetName)
          .table(`${tableName}_raw_changelog`)
          .getRows(),
      (rows) => rows[0].length >= 1,
      10,
      20000
    );

    expect(rows.length).toBe(1);
    console.log(rows[0]);
    const { path_params } = rows[0];

    const pathParams = JSON.parse(path_params);

    expect(pathParams).toHaveProperty("regionId");
    expect(pathParams).toHaveProperty("countryId");
    expect(pathParams.regionId).toBe("europe");
    expect(pathParams.countryId).toBe("france");
  });
});
