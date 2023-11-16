import * as admin from "firebase-admin";
import * as fft from "firebase-functions-test";
import { translateMultipleBackfill } from "../../src/translate/translateMultiple";

jest.mock("../../src/config", () => ({
  default: {
    languages: ["en", "es", "fr"],
    outputFieldName: "translations",
  },
}));

const testFft = fft();

// Mock your translateString function if it's a separate module
jest.mock("../../src/translate/common", () => ({
  ...jest.requireActual("../../src/translate/common"),
  translateString: jest
    .fn()
    .mockImplementation((text, language) =>
      Promise.resolve(`Translated ${text} to ${language}`)
    ),
}));

const mockBulkWriterUpdate = jest.fn().mockImplementation((args) => {
  console.timeLog(args);
});

describe("translateMultipleBackfill", () => {
  // Setup common variables if needed
  let input;
  let snapshot;
  let bulkWriter = {
    update: mockBulkWriterUpdate,
  } as unknown as admin.firestore.BulkWriter;

  beforeEach(() => {
    // Reset mocks and setup common test variables
    jest.clearAllMocks();
  });

  test("should handle valid input correctly", async () => {
    input = ["hello", "how are you?"];

    snapshot = testFft.firestore.makeDocumentSnapshot(
      { foo: "bar" },
      "document/path"
    );

    await translateMultipleBackfill(input, snapshot, bulkWriter);
  });
  // Add more test cases for different scenarios
});
