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
import { afterEach, describe, expect, test, vi } from "vitest";

const INSTANCE_ID = "test-instance";

// The instance id is read when the module loads, so the environment has to be
// in place before each import.
async function importConfig(instanceId: string | undefined) {
  vi.resetModules();
  vi.stubEnv("FIREBASE_CONFIG", JSON.stringify({ projectId: "test-project" }));
  vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", instanceId);
  return import("../src/config");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CONFIG_EXPRESSIONS", () => {
  test("binds the embed trigger to the collection path parameter", async () => {
    const { CONFIG_EXPRESSIONS } = await importConfig(INSTANCE_ID);

    expect(
      (CONFIG_EXPRESSIONS.collectionDocument as Expression<string>).toCEL()
    ).toBe("{{ params.COLLECTION_NAME }}/{docId}");
  });

  test("names the query collection after the instance id", async () => {
    const { CONFIG_EXPRESSIONS } = await importConfig(INSTANCE_ID);

    expect(CONFIG_EXPRESSIONS.queryCollectionDocument).toBe(
      "_test-instance/index/queries/{queryId}"
    );
  });
});

describe("instance id", () => {
  // The CLI injects FIREBASE_KIT_INSTANCE_ID as a reserved env var; declaring
  // it (or INSTANCE_ID) as a param makes the CLI prompt for a value it cannot
  // accept and abort loading the kit.
  test("is not declared as a param", async () => {
    await importConfig(INSTANCE_ID);

    const declared = declaredParams.map((param) => param.name);
    expect(declared).toContain("COLLECTION_NAME");
    expect(declared).not.toContain("INSTANCE_ID");
    expect(declared).not.toContain("FIREBASE_KIT_INSTANCE_ID");
  });

  test("is read from the injected environment", async () => {
    const { configFromEnv } = await importConfig(INSTANCE_ID);

    expect(configFromEnv()).toMatchObject({
      projectId: "test-project",
      instanceId: "test-instance",
    });
  });

  test("fails discovery when FIREBASE_KIT_INSTANCE_ID is missing", async () => {
    await expect(importConfig(undefined)).rejects.toThrow(
      /FIREBASE_KIT_INSTANCE_ID is not set/
    );
  });

  test("throws at runtime when FIREBASE_KIT_INSTANCE_ID is missing", async () => {
    const { configFromEnv } = await importConfig(INSTANCE_ID);
    vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", undefined);

    expect(() => configFromEnv()).toThrow(
      /FIREBASE_KIT_INSTANCE_ID is not set/
    );
  });
});
