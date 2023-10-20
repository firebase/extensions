import * as exportedFunctions from "../src";
import { obfuscatedConfig } from "../src/logs";

const { logger } = require("firebase-functions");

const consoleLogSpy = jest.spyOn(logger, "log").mockImplementation();

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
