/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
