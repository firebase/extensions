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

import { declaredParams, type Expression } from "firebase-functions/params";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CONFIG_EXPRESSIONS, configFromEnv } from "../src/config";

beforeEach(() => {
  vi.stubEnv("FIREBASE_CONFIG", JSON.stringify({ projectId: "test-project" }));
  vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", "test-instance");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CONFIG_EXPRESSIONS", () => {
  test("binds the embed trigger to the collection name parameter", () => {
    expect(
      (CONFIG_EXPRESSIONS.collectionDocument as Expression<string>).toCEL()
    ).toBe("{{ params.COLLECTION_NAME }}/{docId}");
  });
});

describe("instance id", () => {
  // The CLI injects FIREBASE_KIT_INSTANCE_ID as a reserved env var; declaring
  // it (or INSTANCE_ID) as a param makes the CLI prompt for a value it cannot
  // accept and abort loading the kit.
  test("is not declared as a param", () => {
    const declared = declaredParams.map((param) => param.name);

    expect(declared).toContain("COLLECTION_NAME");
    expect(declared).not.toContain("INSTANCE_ID");
    expect(declared).not.toContain("FIREBASE_KIT_INSTANCE_ID");
  });

  test("is read from the injected environment", () => {
    expect(configFromEnv()).toMatchObject({
      projectId: "test-project",
      instanceId: "test-instance",
    });
  });

  test("throws at runtime when FIREBASE_KIT_INSTANCE_ID is missing", () => {
    vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", undefined);

    expect(() => configFromEnv()).toThrow(
      /FIREBASE_KIT_INSTANCE_ID is not set/
    );
  });
});
