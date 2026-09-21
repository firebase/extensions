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

import { declaredParams } from "firebase-functions/params";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { configFromEnv } from "../src/config";

beforeEach(() => {
  vi.stubEnv("FIREBASE_CONFIG", JSON.stringify({ projectId: "test-project" }));
  vi.stubEnv("BACKUP_INSTANCE_ID", "backup-db");
  vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", "test-instance");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("configFromEnv", () => {
  // The CLI injects FIREBASE_KIT_INSTANCE_ID as a reserved env var; declaring
  // it (or INSTANCE_ID) as a param makes the CLI prompt for a value it cannot
  // accept and abort loading the kit.
  test("does not declare an instance-id param", () => {
    const declared = declaredParams.map((param) => param.name);

    expect(declared).toContain("BACKUP_INSTANCE_ID");
    expect(declared).not.toContain("INSTANCE_ID");
    expect(declared).not.toContain("FIREBASE_KIT_INSTANCE_ID");
  });

  test("reads the instance id from the injected environment", () => {
    expect(configFromEnv()).toMatchObject({
      projectId: "test-project",
      instanceId: "test-instance",
      backupInstanceId: "backup-db",
    });
  });

  test("throws when FIREBASE_KIT_INSTANCE_ID is missing", () => {
    vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", undefined);

    expect(() => configFromEnv()).toThrow(
      /FIREBASE_KIT_INSTANCE_ID is not set/
    );
  });
});

/**
 * Compatibility requirement: extension.yaml marks every param below
 * `required: true`, so the extension's installer refuses an empty answer and
 * re-prompts, and it validates three of them against regexes the kit had
 * dropped. The CLI enforces either one for a kit only when the declaration
 * carries it.
 */
describe("params the extension marks required", () => {
  function text(name: string): Record<string, unknown> {
    const param = declaredParams.find(
      (candidate) => candidate.name === name
    ) as { options?: { input?: { text?: Record<string, unknown> } } };

    return param?.options?.input?.text ?? {};
  }

  // `Param.toSpec()` rewrites a declared RegExp to its source string in place,
  // so a declaration read after discovery can hold either form.
  function validationRegex(name: string): RegExp {
    const declared = text(name).validationRegex as RegExp | string;

    return typeof declared === "string" ? new RegExp(declared) : declared;
  }

  test.each([
    "SYNC_COLLECTION_PATH",
    "SYNC_DATASET",
    "SYNC_TABLE",
    "BACKUP_INSTANCE_ID",
  ])("%s refuses an empty value at the prompt", (name) => {
    expect(text(name).nonEmpty).toBe(true);
  });

  test.each([
    ["SYNC_COLLECTION_PATH", /^[^\/]+(\/[^\/]+\/[^\/]+)*$/, "posts", "posts/"],
    ["SYNC_DATASET", /^[a-zA-Z0-9_]+$/, "backup_dataset", "backup dataset"],
    [
      "BACKUP_INSTANCE_ID",
      /^[a-zA-Z][a-zA-Z0-9-]{2,61}[a-zA-Z0-9]$/,
      "backup-db",
      "-backup",
    ],
  ])(
    "%s keeps the extension's validation",
    (name, expected, valid, invalid) => {
      const regex = validationRegex(name as string);

      expect(regex.source).toBe((expected as RegExp).source);
      expect(regex.test(valid as string)).toBe(true);
      expect(regex.test(invalid as string)).toBe(false);
    }
  );
});
