const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

import functionsConfig from "../functions/src/config";
import { obfuscatedConfig } from "../functions/src/logs";
import * as exportedFunctions from "../functions/src";

describe("extension", () => {
  beforeEach(() => {});

  test("functions configuration detected from environment variables", async () => {
    expect(functionsConfig).toMatchSnapshot();
  });

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
