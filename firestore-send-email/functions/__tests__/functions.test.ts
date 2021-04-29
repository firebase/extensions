const { logger } = require("firebase-functions");

const consoleLogSpy = jest.spyOn(logger, "log").mockImplementation();

import { obfuscatedConfig } from "../src/logs";
import * as exportedFunctions from "../src";

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
