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

import { describe, expect, test } from "vitest";

import { resolveConfig } from "../src/export-config";

describe("resolveConfig", () => {
  test("applies defaults for optional fields", () => {
    const resolved = resolveConfig({
      bucket: "demo.appspot.com",
      languageCode: "en-US",
    });

    expect(resolved).toEqual({
      bucket: "demo.appspot.com",
      languageCode: "en-US",
      model: "default",
      outputStoragePath: undefined,
      collectionPath: undefined,
      enableAutomaticPunctuation: true,
      timeoutSeconds: 540,
      memory: "1GiB",
    });
  });

  test("preserves explicit values", () => {
    const resolved = resolveConfig({
      bucket: "b",
      languageCode: "fr-FR",
      model: "video",
      outputStoragePath: "out",
      collectionPath: "transcriptions",
      enableAutomaticPunctuation: false,
      timeoutSeconds: 300,
      memory: "2GiB",
    });

    expect(resolved.model).toBe("video");
    expect(resolved.outputStoragePath).toBe("out");
    expect(resolved.collectionPath).toBe("transcriptions");
    expect(resolved.enableAutomaticPunctuation).toBe(false);
    expect(resolved.timeoutSeconds).toBe(300);
    expect(resolved.memory).toBe("2GiB");
  });

  test("coerces empty optional strings to undefined", () => {
    const resolved = resolveConfig({
      bucket: "b",
      languageCode: "en-US",
      outputStoragePath: "",
      collectionPath: "",
    });

    expect(resolved.outputStoragePath).toBeUndefined();
    expect(resolved.collectionPath).toBeUndefined();
  });
});
