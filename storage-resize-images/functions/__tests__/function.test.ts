import { config } from "../src/config";
jest.mock("../src/config");
jest.mock("../src");

// Define your mock functions first
const logMock = jest.fn().mockReturnValue(0);
const errorLogMock = jest.fn().mockReturnValue(0);
const warnLogMock = jest.fn().mockReturnValue(0);

jest.mock("firebase-functions", () => {
  return {
    ...jest.requireActual("firebase-functions"),
    logger: {
      log: jest.fn((...args) => logMock(...args)), // Spread operator to pass all arguments
      error: jest.fn((...args) => errorLogMock(...args)),
      warn: jest.fn((...args) => warnLogMock(...args)),
    },
  };
});

jest.mock("../src/config", () => {
  return {
    config: {
      location: "us-central1",
      imgBucket: "extensions-testing.appspot.com",
      cacheControlHeader: undefined,
      imgSizes: ["200x200"],
      resizedImagesPath: undefined,
      deleteOriginalFile: "true",
    },
  };
});

import { generateResizedImage } from "../src";

describe("extension", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("'generateResizedImage' function is exported", () => {
    const exportedFunctions = jest.requireActual("../src");
    expect(exportedFunctions.generateResizedImage).toBeInstanceOf(Function);
  });
});
