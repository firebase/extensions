import * as functionsTest from "firebase-functions-test";
import * as functions from "firebase-functions";
import { Status } from "../src/types";
import { transcribeAudio } from "../src/index";
import {
  transcribeAndUpload,
  uploadTranscodedFile,
} from "../src/transcribe-audio";
import { EventContextOptions } from "firebase-functions-test/lib/v1";
import * as admin from "firebase-admin";

import config from "../src/config";

process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.PUBSUB_EMULATOR_HOST = "127.0.0.1:8085";
process.env.GOOGLE_CLOUD_PROJECT = "demo-gcp";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const storage = admin.storage();
const bucket = storage.bucket("demo-gcp.appspot.com");

// Initialize the firebase-functions-test library
const testEnv = functionsTest({
  projectId: "demo-gcp",
  storageBucket: "demo-gcp.appspot.com",
});

jest.mock("../src/config", () => {
  return {
    default: {
      projectId: "demo-gcp",
      location: "us-central1",
      collectionPath: "test_collection",
      bucket: "demo-gcp.appspot.com",
      outputStoragePath: "",
      model: null,
      languageCode: "en-GB",
    },
  };
});

jest.mock("@google-cloud/speech", () => ({
  SpeechClient: jest.fn(() => ({})),
}));

// Mock the other imported modules
jest.mock("../src/transcribe-audio", () => ({
  transcodeToLinear16: jest.fn(() => ({
    status: Status.SUCCESS,
    outputPath: "transcoded-file-path",
    sampleRateHertz: 16000,
    audioChannelCount: 1,
  })),
  transcribeAndUpload: jest.fn(() => ({
    transciption: "test transcription",
    status: Status.SUCCESS,
  })),
  uploadTranscodedFile: jest.fn(() => ({
    status: Status.SUCCESS,
    transciption: "test transcription",
    uploadResponse: [{}, {}],
    outputPath: "",
  })),
}));

const db = admin.firestore();

describe("transcribeAudio", () => {
  beforeAll(async () => {
    await bucket.upload(__dirname + "/fixtures/test.wav");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test cases
  test("should process the audio and transcribe it successfully", async () => {
    // Arrange: create a valid storage object and mock successful transcode and transcribe results
    const object: functions.storage.ObjectMetadata & EventContextOptions = {
      name: "test.wav",
      bucket: "demo-gcp.appspot.com",
      contentType: "audio/wav",
      kind: "",
      id: "",
      storageClass: "",
      size: "",
      timeCreated: "",
      updated: "",
    };

    // Act: call the transcribeAudio function with the valid object
    const fn = testEnv.wrap(transcribeAudio);
    await fn(object);

    // Assert: check if the proper functions are called and the processing is completed successfully
    expect(transcribeAndUpload).toHaveBeenCalledTimes(1);
    expect(uploadTranscodedFile).toHaveBeenCalledTimes(1);
  });

  test("should not process the audio if contentType is not set", async () => {
    // Arrange: create a fake storage object with no contentType
    const object: functions.storage.ObjectMetadata & EventContextOptions = {
      name: "test.wav",
      bucket: "demo-gcp.appspot.com",
      kind: "",
      id: "",
      storageClass: "",
      size: "",
      timeCreated: "",
      updated: "",
    };

    /** Run the function */
    await transcribeAudio(testEnv.wrap(transcribeAudio), object);

    /** Check results */
    expect(transcribeAndUpload).toHaveBeenCalledTimes(0);
    expect(uploadTranscodedFile).toHaveBeenCalledTimes(0);
  });

  test('should not process the audio if contentType is not "audio/"', async () => {
    // Arrange: create a fake storage object with an invalid contentType
    const object = {
      name: "test.wav",
      bucket: "demo-gcp.appspot.com",
      contentType: "text/plain",
    };

    /** Run the function */
    await transcribeAudio(testEnv.wrap(transcribeAudio), object);

    /** Check results */
    expect(transcribeAndUpload).toHaveBeenCalledTimes(0);
    expect(uploadTranscodedFile).toHaveBeenCalledTimes(0);
  });

  test("should not process the audio if object name is undefined", async () => {
    /** Setup the uploaded storage object  */
    const object = {
      bucket: "demo-gcp.appspot.com",
      contentType: "audio/wav",
    };

    /** Run the function */
    await transcribeAudio(testEnv.wrap(transcribeAudio), object);

    /** Check results */
    expect(transcribeAndUpload).toHaveBeenCalledTimes(0);
    expect(uploadTranscodedFile).toHaveBeenCalledTimes(0);
  });

  test("should handle error when transcode fails", async () => {
    // Arrange: create a valid storage object and mock a failed transcode result
    const object: functions.storage.ObjectMetadata & EventContextOptions = {
      name: "test.wav",
      bucket: "demo-gcp.appspot.com",
      contentType: "audio/wav",
      kind: "",
      id: "",
      storageClass: "",
      size: "",
      timeCreated: "",
      updated: "",
    };

    // Mock the transcodeToLinear16 function to return a failed result
    const mockTranscodeToLinear16 =
      require("../src/transcribe-audio").transcodeToLinear16;
    mockTranscodeToLinear16.mockImplementation(() => ({
      status: Status.FAILURE,
    }));

    // Act: call the transcribeAudio function with the valid object
    const fn = testEnv.wrap(transcribeAudio);
    await fn(object);

    // Assert: check if the proper functions are called and the processing is halted due to the error
    expect(transcribeAndUpload).toHaveBeenCalledTimes(0);
    expect(uploadTranscodedFile).toHaveBeenCalledTimes(0);
  });

  test("should handle error when transcribe fails", async () => {
    // Arrange: create a valid storage object and mock a failed transcribe result
    const object: functions.storage.ObjectMetadata & EventContextOptions = {
      name: "test.wav",
      bucket: "demo-gcp.appspot.com",
      contentType: "audio/wav",
      kind: "",
      id: "",
      storageClass: "",
      size: "",
      timeCreated: "",
      updated: "",
    };

    // Mock the transcribeAndUpload function to return a failed result
    const mockTranscribeAndUpload =
      require("../src/transcribe-audio").transcribeAndUpload;
    mockTranscribeAndUpload.mockImplementation(() => ({
      status: Status.FAILURE,
    }));

    // Act: call the transcribeAudio function with the valid object
    const fn = testEnv.wrap(transcribeAudio);
    await fn(object);

    // Assert: check if the proper functions are called and the processing is halted due to the error
    expect(transcribeAndUpload).toHaveBeenCalledTimes(0);
    expect(uploadTranscodedFile).toHaveBeenCalledTimes(0); // The uploadTranscodedFile should not be called when transcribe fails
  });
});

describe("Firestore integration", () => {
  beforeEach(async () => {
    await fetch(
      "http://127.0.0.1:8080/emulator/v1/projects/demo-gcp/databases/(default)/documents",
      { method: "DELETE" }
    );

    /** wait for 2 seconds */
    await new Promise((resolve) => setTimeout(resolve, 2000));

    /** Clear all mocks */
    jest.clearAllMocks();
  });

  test("Should correctly write the result to Firestore when configured", async () => {
    // Arrange: create a valid storage object and mock a failed transcribe result
    const object: functions.storage.ObjectMetadata & EventContextOptions = {
      name: "test.wav",
      bucket: "demo-gcp.appspot.com",
      contentType: "audio/wav",
      kind: "",
      id: "",
      storageClass: "",
      size: "",
      timeCreated: "",
      updated: "",
    };

    // Mock the transcribeAndUpload function to return a failed result
    const mockTranscribeAndUpload =
      require("../src/transcribe-audio").transcribeAndUpload;
    mockTranscribeAndUpload.mockImplementation(() => ({
      status: Status.SUCCESS,
      transcription: "test transcription",
      outputPath: "",
    }));

    const mockTranscodeToLinear16 =
      require("../src/transcribe-audio").transcodeToLinear16;

    mockTranscodeToLinear16.mockImplementation(() => ({
      status: Status.SUCCESS,
      outputPath: "",
    }));

    // Act: call the transcribeAudio function with the valid object
    const fn = testEnv.wrap(transcribeAudio);
    await fn(object);

    /** Wait for 5 seconds */
    await new Promise((resolve) => setTimeout(resolve, 5000));

    /** Get the new document */
    const collection = db.collection(config.collectionPath!);
    const doc = await collection
      .where("fileName", "==", "test.wav")
      .limit(1)
      .get()
      .then((snapshot) => snapshot.docs[0]);

    /** Check assertions */
    const { status, transcription, created } = doc.data() || {};
    expect(transcription).toBe("test transcription");
    expect(Status[status]).toBe(Status.SUCCESS);
    expect(created).toBeDefined();
  }, 12000);

  test("Should not write the result to Firestore when not configured", async () => {
    /** set collection path to null */
    config.collectionPath = "";

    // Arrange: create a valid storage object and mock a failed transcribe result
    const object: functions.storage.ObjectMetadata & EventContextOptions = {
      name: "test.wav",
      bucket: "demo-gcp.appspot.com",
      contentType: "audio/wav",
      kind: "",
      id: "",
      storageClass: "",
      size: "",
      timeCreated: "",
      updated: "",
    };

    // Mock the transcribeAndUpload function to return a failed result
    const mockTranscribeAndUpload =
      require("../src/transcribe-audio").transcribeAndUpload;
    mockTranscribeAndUpload.mockImplementation(() => ({
      status: Status.SUCCESS,
    }));

    // Act: call the transcribeAudio function with the valid object
    const fn = testEnv.wrap(transcribeAudio);
    await fn(object);

    await db.listCollections().then((collections) => {
      expect(collections.length).toBe(0);
    });
  });
});
