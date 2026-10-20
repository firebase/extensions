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
  test("writes an ERROR entry naming the function, event and error", () => {
    const write = vi.spyOn(logger, "write").mockImplementation(() => {});
    const err = new Error("boom");

    logs.unhandledError("handleDeletion", "event-1", err);

    expect(write).toHaveBeenCalledWith({
      severity: "ERROR",
      message: "Function handleDeletion failed on event event-1: boom",
      functionName: "handleDeletion",
      eventId: "event-1",
      errorStack: err.stack,
    });
  });

  // Error Reporting reads stacks from `message`. The framework already logs
  // the stack it reports on, so a stack here would report the failure twice.
  test("keeps the stack out of the message", () => {
    const write = vi.spyOn(logger, "write").mockImplementation(() => {});

    logs.unhandledError("clearData", "event-2", new Error("boom"));

    expect(write.mock.calls[0][0].message).not.toMatch(/\n\s+at /);
  });

  test("handles a thrown value that is not an Error", () => {
    const write = vi.spyOn(logger, "write").mockImplementation(() => {});

    logs.unhandledError("handleSearch", "event-3", "plain string");

    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "ERROR",
        message: "Function handleSearch failed on event event-3: plain string",
        errorStack: undefined,
      })
    );
  });
});
