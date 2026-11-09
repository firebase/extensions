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

import { logger } from "firebase-functions";
import { afterEach, describe, expect, test, vi } from "vitest";
import * as logs from "../src/logs";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("unhandledError", () => {
  test("writes the error's stack as an ERROR entry", () => {
    const write = vi.spyOn(logger, "write").mockImplementation(() => {});
    const err = new Error("boom");

    logs.unhandledError(err);

    expect(write).toHaveBeenCalledWith({
      severity: "ERROR",
      message: err.stack,
    });
  });

  test("handles a thrown value that is not an Error", () => {
    const write = vi.spyOn(logger, "write").mockImplementation(() => {});

    logs.unhandledError("plain string");

    expect(write).toHaveBeenCalledWith({
      severity: "ERROR",
      message: "plain string",
    });
  });
});
