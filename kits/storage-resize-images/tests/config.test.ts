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

import { Expression } from "firebase-functions/params";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  CONFIG_EXPRESSIONS,
  configFromEnv,
  validatePathListsFromEnv,
} from "../src/config";
import { DELETE_IMAGE, resolveResizeImagesConfig } from "../src/export-config";

const cel = (value: unknown): string =>
  value instanceof Expression ? value.toCEL() : String(value);

describe("configFromEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("maps the params a deployed instance sets", () => {
    vi.stubEnv("IMG_BUCKET", "demo.appspot.com");
    vi.stubEnv("IMG_SIZES", "200x200,400x400");
    vi.stubEnv("DELETE_ORIGINAL_FILE", "on_success");
    // Firebase writes list params into the environment as JSON.
    vi.stubEnv("IMAGE_TYPE", '["jpeg","webp"]');
    vi.stubEnv("RESIZED_IMAGES_PATH", "thumbs");
    vi.stubEnv("CONTENT_FILTER_LEVEL", "BLOCK_ONLY_HIGH");
    vi.stubEnv("FUNCTION_MEMORY", "2048");
    vi.stubEnv("FUNCTION_REGION", "europe-west1");

    const config = configFromEnv();

    expect(config.bucket).toBe("demo.appspot.com");
    expect(config.sizes).toBe("200x200,400x400");
    expect(config.deleteOriginal).toBe("on_success");
    expect(config.imageTypes).toEqual(["jpeg", "webp"]);
    expect(config.resizedImagesPath).toBe("thumbs");
    expect(config.contentFilterLevel).toBe("BLOCK_ONLY_HIGH");
    expect(config.memory).toBe(2048);
    expect(config.region).toBe("europe-west1");
  });

  test("resolves into the config the handlers use", () => {
    vi.stubEnv("IMG_BUCKET", "demo.appspot.com");
    vi.stubEnv("IMG_SIZES", "200x200");
    vi.stubEnv("DELETE_ORIGINAL_FILE", "true");
    vi.stubEnv("IMAGE_TYPE", '["false"]');
    vi.stubEnv("CONTENT_FILTER_LEVEL", "OFF");
    vi.stubEnv("FUNCTION_MEMORY", "1024");

    const resolved = resolveResizeImagesConfig(configFromEnv());

    expect(resolved.imageSizes).toEqual(["200x200"]);
    expect(resolved.deleteOriginalFile).toBe(DELETE_IMAGE.always);
    expect(resolved.contentFilterLevel).toBeNull();
    expect(resolved.memory).toBe("1GiB");
  });

  test("leaves unset optional strings undefined rather than empty", () => {
    vi.stubEnv("IMG_BUCKET", "demo.appspot.com");
    vi.stubEnv("IMAGE_TYPE", '["false"]');

    const config = configFromEnv();

    expect(config.resizedImagesPath).toBeUndefined();
    expect(config.failedImagesPath).toBeUndefined();
    expect(config.includePathList).toBeUndefined();
    expect(config.excludePathList).toBeUndefined();
    expect(config.cacheControlHeader).toBeUndefined();
    expect(config.customFilterPrompt).toBeUndefined();
    expect(config.placeholderImagePath).toBeUndefined();
  });
});

describe("validatePathListsFromEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("rejects a relative include path before the function deploys", () => {
    vi.stubEnv("INCLUDE_PATH_LIST", "relative/path");

    expect(() => validatePathListsFromEnv()).toThrow("Invalid includePathList");
  });

  test("rejects a relative exclude path before the function deploys", () => {
    vi.stubEnv("EXCLUDE_PATH_LIST", "relative/path");

    expect(() => validatePathListsFromEnv()).toThrow("Invalid excludePathList");
  });

  test("accepts absolute paths", () => {
    vi.stubEnv("INCLUDE_PATH_LIST", "/users/avatars,/design/pictures");
    vi.stubEnv("EXCLUDE_PATH_LIST", "/users/avatars/thumbs");

    expect(() => validatePathListsFromEnv()).not.toThrow();
  });
});

describe("CONFIG_EXPRESSIONS", () => {
  test("keeps the bucket and memory as params for the discovery manifest", () => {
    expect(cel(CONFIG_EXPRESSIONS.bucket)).toBe("{{ params.IMG_BUCKET }}");
    expect(cel(CONFIG_EXPRESSIONS.memory)).toBe("{{ params.FUNCTION_MEMORY }}");
  });
});
