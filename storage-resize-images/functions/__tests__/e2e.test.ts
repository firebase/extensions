import * as admin from "firebase-admin";
import { config } from "dotenv";
import * as path from "path";

const envLocalPath = path.resolve(
  __dirname,
  "../../../_emulator/extensions/storage-resize-images.env.local"
);

config({ path: envLocalPath, debug: true, override: true });

let storage;

process.env.FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
process.env.PUBSUB_EMULATOR_HOST = "localhost:8085";
process.env.GOOGLE_CLOUD_PROJECT = "demo-test";
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

describe("extension", () => {
  beforeEach(async () => {
    // if there is no app, initialize one
    if (!admin.apps.length) {
      admin.initializeApp({
        projectId: "demo-test",
        storageBucket: "demo-test.appspot.com",
      });
    }
    storage = admin.storage();
    await storage.bucket().upload(__dirname + "/not-an-image.jpeg", {});
    await storage.bucket().upload(__dirname + "/test-image.jpeg", {});
  });
  afterEach(async () => {
    // await storage.bucket().deleteFiles(process.env.RESIZED_IMAGES_PATH);
  });

  test("should resize image successfully, and copy failed image to failed directory", async () => {
    const successFilePath = `${process.env.RESIZED_IMAGES_PATH}/test-image_${process.env.IMG_SIZES}.${process.env.IMAGE_TYPE}`;
    // wait for file to be uploaded to storage:
    expect(await waitForFile(successFilePath)).toBe(true);

    const failureFilePath = `${process.env.FAILED_IMAGES_PATH}/not-an-image.jpeg`;

    expect(await waitForFile(failureFilePath)).toBe(true);
  });
});

const waitForFile = async (
  filePath: string,
  timeout: number = 1000,
  maxAttempts: number = 20
) => {
  let exists: boolean;

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
