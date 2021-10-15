import * as admin from "firebase-admin";
import Templates from "../src/templates";

const { logger } = require("firebase-functions");
const consoleLogSpy = jest.spyOn(logger, "log").mockImplementation();

import { obfuscatedConfig } from "../src/logs";
import * as exportedFunctions from "../src";
import { UserRecord } from "firebase-functions/v1/auth";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

admin.initializeApp({
  projectId: "extensions-testing",
});

describe("extension", () => {
  test("functions configuration is logged on initialize", async () => {
    expect(consoleLogSpy).toBeCalledWith(
      "Initializing extension with configuration",
      obfuscatedConfig
    );
  });

  test("functions are exported", async () => {
    expect(exportedFunctions.processQueue).toBeInstanceOf(Function);
  });
});

describe("findUser", () => {
  let user: UserRecord | undefined = null;

  beforeAll(async () => {
    const createdUser = await admin.auth().createUser({
      email: `${(Math.random() + 1).toString(36).substring(7)}@google.com`,
      displayName: "test_name",
    });

    user = createdUser;
  });
  test("return user data based on a single uid array", async () => {
    const result: UserRecord = await exportedFunctions.findUser([user.uid]);

    expect(result.uid).toBe(user.uid);
  });

  test("return user data based on a uid string", async () => {
    const result: UserRecord = await exportedFunctions.findUser(user.uid);

    expect(result.uid).toBe(user.uid);
  });

  test("return user data based on a single email array", async () => {
    const result = await exportedFunctions.findUser([user.email]);

    expect(result.uid).toBe(user.uid);
  });

  test("return user data based on a  email string", async () => {
    const result = await exportedFunctions.findUser(user.email);

    expect(result.uid).toBe(user.uid);
  });

  test("return null based on a comma seperated email string", async () => {
    const result = await exportedFunctions.findUser(
      `${user.email},test@test.com`
    );

    expect(result).toBeNull();
  });

  test("returns null with multiple user Ids ", async () => {
    const result = await exportedFunctions.findUser([user.uid, "another_id"]);

    expect(result).toBeNull();
  });
});
