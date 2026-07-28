// Import dependencies

import * as admin from "firebase-admin";
import { Bucket } from "@google-cloud/storage";

import { uploadTranscodedFile } from "../src/transcribe-audio";
import { Status, UploadAudioResult } from "../src/types";

process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.PUBSUB_EMULATOR_HOST = "127.0.0.1:8085";
process.env.GOOGLE_CLOUD_PROJECT = "demo-test";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

admin.initializeApp({ projectId: "demo-gcp" });

describe("transcribe-audio", () => {
  describe("uploadTranscodedFile", () => {
    const bucket: Bucket = admin.storage().bucket("demo-test.appspot.com");

    it("should successfully transribe a file", async () => {
      // Arrange
      const localPath = __dirname + "/fixtures/test.wav";
      const storagePath = "transcoded/testfile.wav";

      // Act
      const result = await uploadTranscodedFile({
        localPath,
        storagePath,
        bucket,
      });

      /** Check results */
      expect(result.status).toBe(Status.SUCCESS);
    });

    /**
     * TODO: Uses long running and tasks and ffmpeg local install
     * Contener for local e2e testing
     */
    xit("should successfully transribe to Firestore", async () => {
      // Arrange
      const localPath = __dirname + "/fixtures/test.wav";
      const storagePath = "transcoded/testfile.wav";

      jest.mock("../src/config", () => ({
        OUTPUT_FIRESTORE_COLLECTION: "transcribed",
        EXTENSION_BUCKET: "demo-test.appspot.com",
      }));

      // Act
      const result = await uploadTranscodedFile({
        localPath,
        storagePath,
        bucket,
      });

      /** Check results */
      expect(result.status).toBe(Status.SUCCESS);
    }, 20000);

    /**
     * TODO: Uses long running and tasks and ffmpeg local install
     * Contener for local e2e testing
     */
    xit("should successfully transribe a file", async () => {
      // Arrange
      const localPath = __dirname + "/fixtures/test.wav";
      const storagePath = "transcoded/testfile.wav";

      // Act
      const result = await uploadTranscodedFile({
        localPath,
        storagePath,
        bucket,
      });

      /** Check results */
      expect(result.status).toBe(Status.SUCCESS);
    });

    it("should return failure when localPath is invalid", async () => {
      /** Setup parameters */
      const localPath = "";
      const storagePath = "transcoded/testfile.wav";

      /** Upload file */
      const result: UploadAudioResult = await uploadTranscodedFile({
        localPath,
        storagePath,
        bucket,
      });

      /** Check results */
      expect(result.status).toBe(Status.FAILURE);
    });

    it("should return failure when bucket is missing", async () => {
      /** Setup parameters */
      const localPath = "testfile.wav";
      const storagePath = "transcoded/testfile.wav";
      const missingBucket = admin.storage().bucket("does-not-exist"); // Missing bucket

      /** Upload file */
      const result = await uploadTranscodedFile({
        localPath,
        storagePath,
        bucket: missingBucket,
      });

      /** Check results */
      expect(result.status).toBe(Status.FAILURE);
    });

    it("should return failure when file upload fails", async () => {
      // Arrange
      const localPath = "testfile.wav";
      const storagePath = "transcoded/testfile.wav";

      const error = new Error("Upload failed");
      bucket.upload = jest.fn().mockRejectedValue(error);

      // Act
      const result = await uploadTranscodedFile({
        localPath,
        storagePath,
        bucket,
      });

      /** Check results */
      expect(result.status).toBe(Status.FAILURE);
    });
  });
});
