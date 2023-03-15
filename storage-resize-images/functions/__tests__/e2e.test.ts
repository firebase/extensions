import * as admin from "firebase-admin";
import { Storage } from "firebase-admin/storage";
import { config } from "dotenv";
import * as path from "path";
import { waitForFile } from "./util";

const envLocalPath = path.resolve(
  __dirname,
  "../../../_emulator/extensions/storage-resize-images.env.local"
);

config({ path: envLocalPath, debug: true, override: true });

let storage: Storage;

process.env.FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
process.env.PUBSUB_EMULATOR_HOST = "localhost:8085";
process.env.GOOGLE_CLOUD_PROJECT = "demo-test";
process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

describe("extension", () => {
  beforeAll(async () => {
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
    await storage.bucket().upload(__dirname + "/test-img.jfif", {
      metadata: { contentType: "image/jpeg" },
    });
  });

  test("should resize (test-image.jpeg) successfully", async () => {
    const successFilePath = `${process.env.RESIZED_IMAGES_PATH}/test-image_${process.env.IMG_SIZES}.${process.env.IMAGE_TYPE}`;
    // wait for file to be uploaded to storage:
    expect(await waitForFile(storage, successFilePath)).toBe(true);
  }, 12000);

  test("should copy failed image (not-an-image.jpeg) to failed directory", async () => {
    const failureFilePath = `${process.env.FAILED_IMAGES_PATH}/not-an-image.jpeg`;

    expect(await waitForFile(storage, failureFilePath)).toBe(true);
  }, 12000);

  test("should resize test-img.jfif successfully", async () => {
    const successFilePath = `${process.env.RESIZED_IMAGES_PATH}/test-img_${process.env.IMG_SIZES}.${process.env.IMAGE_TYPE}`;

    expect(await waitForFile(storage, successFilePath)).toBe(true);
  }, 12000);
});
