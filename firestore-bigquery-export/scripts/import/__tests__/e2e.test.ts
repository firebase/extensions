import { BigQuery } from "@google-cloud/bigquery";
import * as childProcess from "child_process";
import * as admin from "firebase-admin";
import * as path from "path";

import { repeat } from "./helpers/waitFor";

const scriptPath = path.join(__dirname, "../lib/index.js");
const projectId = "extensions-testing";

const bigquery = new BigQuery({ projectId });

async function runScript(scriptPath: string, args?: string[]) {
  return new Promise<void>((resolve, reject) => {
    let invoked = false;
    const child = childProcess.fork(scriptPath, args, {
      cwd: __dirname,
      stdio: [process.stdin, process.stdout, process.stderr, "ipc"],
      env: { ...process.env },
    });

    child.on("error", (err) => {
      if (!invoked) {
        invoked = true;
        reject(err);
      }
    });

    child.on("exit", (code) => {
      if (!invoked) {
        invoked = true;
        code === 0 ? resolve() : reject(new Error("exit code " + code));
      }
    });
  });
}

async function clearFirestoreData() {
  await fetch(
    `http://localhost:8080/emulator/v1/projects/extensions-testing/databases/(default)/documents`,
    { method: "DELETE" }
  );
}

async function setupFirestore(collectionName: string) {
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

  if (!admin.apps.length) {
    admin.initializeApp();
  }

  const firestore = admin.firestore();
  await firestore.collection(collectionName).doc("test").set({ test: "test" });

  return firestore;
}

async function cleanupBigQuery(datasetName: string) {
  await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for data to settle
  const datasetExists = await bigquery.dataset(datasetName).exists();
  if (datasetExists[0]) {
    await bigquery.dataset(datasetName).delete({ force: true });
  }
}

async function runTestScript(
  args: string[],
  datasetName: string,
  tableName: string,
  expectedRowCount: number
) {
  await runScript(scriptPath, args);

  const [rows] = await repeat(
    () =>
      bigquery
        .dataset(datasetName)
        .table(`${tableName}_raw_changelog`)
        .getRows(),
    (rows) => rows[0].length >= expectedRowCount,
    10,
    20000
  );

  return rows;
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
    firestore = await setupFirestore(collectionName);
  });

  afterEach(async () => {
    await cleanupBigQuery(datasetName);
    await clearFirestoreData();
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

    const rows = await runTestScript(args, datasetName, tableName, 1);

    const {
      operation,
      document_name,
      document_id,
      data,
      event_id,
      old_data,
      timestamp,
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

    const rows = await runTestScript(args, datasetName, tableName, 1);

    expect(rows.length).toBeGreaterThanOrEqual(1);

    const {
      operation,
      document_name,
      document_id,
      data,
      event_id,
      old_data,
      timestamp,
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
    expect(query.includes("FIRST_VALUE")).toBe(false);
  });

  test("basic collection group query", async () => {
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

    const rows = await runTestScript(args, datasetName, tableName, 2);

    expect(rows.length).toBe(2);

    const { operation, event_id, old_data, timestamp } = rows[0];

    expect(operation).toBe("IMPORT");
    expect(event_id).toBe("");
    expect(old_data).toBeNull();
    expect(timestamp).toBeDefined();

    const [view] = await bigquery
      .dataset(datasetName)
      .table(`${tableName}_raw_latest`)
      .get();

    const query = view.metadata.view.query;
    expect(query).toBeDefined();
    expect(query.includes("FIRST_VALUE")).toBe(false);
  });

  test("wildcarded collection group query", async () => {
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

    const rows = await runTestScript(args, datasetName, tableName, 2);

    expect(rows.length).toBe(2);

    const { operation, event_id, old_data, timestamp } = rows[0];

    expect(operation).toBe("IMPORT");
    expect(event_id).toBe("");
    expect(old_data).toBeNull();
    expect(timestamp).toBeDefined();

    const [view] = await bigquery
      .dataset(datasetName)
      .table(`${tableName}_raw_latest`)
      .get();

    const query = view.metadata.view.query;
    expect(query).toBeDefined();
    expect(query.includes("FIRST_VALUE")).toBe(false);
  });

  test("shouldn't export non-matching results from collection group query", async () => {
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

    const rows = await runTestScript(args, datasetName, tableName, 2);

    expect(rows.length).toBe(2);

    const { operation, event_id, old_data, timestamp } = rows[0];

    expect(operation).toBe("IMPORT");
    expect(event_id).toBe("");
    expect(old_data).toBeNull();
    expect(timestamp).toBeDefined();

    const [view] = await bigquery
      .dataset(datasetName)
      .table(`${tableName}_raw_latest`)
      .get();

    const query = view.metadata.view.query;
    expect(query).toBeDefined();
    expect(query.includes("FIRST_VALUE")).toBe(false);
  });

  test("should match several wildcards in one query", async () => {
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

    const rows = await runTestScript(args, datasetName, tableName, 1);

    expect(rows.length).toBe(1);

    const { path_params } = rows[0];
    const pathParams = JSON.parse(path_params);

    expect(pathParams).toHaveProperty("regionId", "europe");
    expect(pathParams).toHaveProperty("countryId", "france");
  });
});

describe("e2e multi thread", () => {
  let firestore;
  let collectionName = "testCollection";
  let datasetName = "testDataset";
  let tableName = "testTable";

  beforeEach(async () => {
    const randomID = Math.random().toString(36).substring(7);
    collectionName = `testCollection_${randomID}`;
    datasetName = `testDataset_${randomID}`;
    tableName = `testTable_${randomID}`;
    firestore = await setupFirestore(collectionName);
  });

  afterEach(async () => {
    await cleanupBigQuery(datasetName);
    await clearFirestoreData();
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
      "-m",
    ];

    const rows = await runTestScript(args, datasetName, tableName, 1);

    const {
      operation,
      document_name,
      document_id,
      data,
      event_id,
      old_data,
      timestamp,
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
      "-m",
    ];

    const rows = await runTestScript(args, datasetName, tableName, 1);

    expect(rows.length).toBeGreaterThanOrEqual(1);

    const {
      operation,
      document_name,
      document_id,
      data,
      event_id,
      old_data,
      timestamp,
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
    expect(query.includes("FIRST_VALUE")).toBe(false);
  });

  test("basic collection group query", async () => {
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
      "-m",
    ];

    const rows = await runTestScript(args, datasetName, tableName, 2);

    expect(rows.length).toBe(2);

    const { operation, event_id, old_data, timestamp } = rows[0];

    expect(operation).toBe("IMPORT");
    expect(event_id).toBe("");
    expect(old_data).toBeNull();
    expect(timestamp).toBeDefined();

    const [view] = await bigquery
      .dataset(datasetName)
      .table(`${tableName}_raw_latest`)
      .get();

    const query = view.metadata.view.query;
    expect(query).toBeDefined();
    expect(query.includes("FIRST_VALUE")).toBe(false);
  });

  test("wildcarded collection group query", async () => {
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
      "-m",
    ];

    const rows = await runTestScript(args, datasetName, tableName, 2);

    expect(rows.length).toBe(2);

    const { operation, event_id, old_data, timestamp } = rows[0];

    expect(operation).toBe("IMPORT");
    expect(event_id).toBe("");
    expect(old_data).toBeNull();
    expect(timestamp).toBeDefined();

    const [view] = await bigquery
      .dataset(datasetName)
      .table(`${tableName}_raw_latest`)
      .get();

    const query = view.metadata.view.query;
    expect(query).toBeDefined();
    expect(query.includes("FIRST_VALUE")).toBe(false);
  });

  test("shouldn't export non-matching results from collection group query", async () => {
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
      "-m",
    ];

    const rows = await runTestScript(args, datasetName, tableName, 2);

    expect(rows.length).toBe(2);

    const { operation, event_id, old_data, timestamp } = rows[0];

    expect(operation).toBe("IMPORT");
    expect(event_id).toBe("");
    expect(old_data).toBeNull();
    expect(timestamp).toBeDefined();

    const [view] = await bigquery
      .dataset(datasetName)
      .table(`${tableName}_raw_latest`)
      .get();

    const query = view.metadata.view.query;
    expect(query).toBeDefined();
    expect(query.includes("FIRST_VALUE")).toBe(false);
  });

  test("should match several wildcards in one query", async () => {
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

    const rows = await runTestScript(args, datasetName, tableName, 1);

    expect(rows.length).toBe(1);

    const { path_params } = rows[0];
    const pathParams = JSON.parse(path_params);

    expect(pathParams).toHaveProperty("regionId", "europe");
    expect(pathParams).toHaveProperty("countryId", "france");
  });
});
