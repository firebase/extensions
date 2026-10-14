/*
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

import { describe, expect, test, vi } from "vitest";

vi.mock("firebase-functions", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("firebase-functions/params", () => {
  throw new Error("./lib must not import firebase-functions/params");
});

describe("./lib", () => {
  test("imports without declaring Firebase params", async () => {
    const lib = await import("../src/lib");

    expect(lib.handleMessagePublished).toBeTypeOf("function");
    expect(lib.handleUpsertTransferConfig).toBeTypeOf("function");
    expect(lib.resolveConfig).toBeTypeOf("function");
    expect(lib.createTransferConfigRequest).toBeTypeOf("function");
    expect(lib.convertUnsupportedDataTypes).toBeTypeOf("function");
  }, 15000);
});
