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

/**
 * Parity with the extension's `__tests__/config.test.ts` (+ snapshot). The
 * extension resolves config from `process.env` at module load, so its tests
 * swap the environment and re-require the module. The kit resolves the same
 * shape through a pure function, so the same assertions become direct calls
 * to `resolveResizeImagesConfig`.
 */

import { afterEach, describe, expect, test } from "vitest";

import {
  convertHarmBlockThreshold,
  DELETE_IMAGE,
  type ResizeImagesConfig,
  resolveResizeImagesConfig,
  validateAbsolutePathList,
} from "../src/export-config";

/** Mirrors the extension's test environment, as a config object. */
const baseConfig: ResizeImagesConfig = {
  bucket: "extensions-testing.appspot.com",
  sizes: "200x200",
  cacheControlHeader: undefined,
  resizedImagesPath: undefined,
  deleteOriginal: "true",
  contentFilterLevel: "OFF",
};

describe("resolveResizeImagesConfig", () => {
  const ORIGINAL_REGION = process.env.FUNCTION_REGION;

  afterEach(() => {
    if (ORIGINAL_REGION === undefined) {
      delete process.env.FUNCTION_REGION;
    } else {
      process.env.FUNCTION_REGION = ORIGINAL_REGION;
    }
  });

  test("configuration resolved from the input config", () => {
    delete process.env.FUNCTION_REGION;
    expect(resolveResizeImagesConfig(baseConfig)).toMatchSnapshot({});
  });

  test("always delete original file", () => {
    const resolved = resolveResizeImagesConfig({
      ...baseConfig,
      deleteOriginal: "true",
    });
    expect(resolved.deleteOriginalFile).toEqual(DELETE_IMAGE.always);
  });

  test("never delete original file", () => {
    const resolved = resolveResizeImagesConfig({
      ...baseConfig,
      deleteOriginal: "false",
    });
    expect(resolved.deleteOriginalFile).toEqual(DELETE_IMAGE.never);
  });

  test("delete original file on success", () => {
    const resolved = resolveResizeImagesConfig({
      ...baseConfig,
      deleteOriginal: "on_success",
    });
    expect(resolved.deleteOriginalFile).toEqual(DELETE_IMAGE.onSuccess);
  });

  test("accepts booleans as well as strings for deleteOriginal", () => {
    // The extension is string-only; the kit takes either.
    expect(
      resolveResizeImagesConfig({ ...baseConfig, deleteOriginal: true })
        .deleteOriginalFile
    ).toEqual(DELETE_IMAGE.always);
    expect(
      resolveResizeImagesConfig({ ...baseConfig, deleteOriginal: false })
        .deleteOriginalFile
    ).toEqual(DELETE_IMAGE.never);
  });

  test("an unset deleteOriginal deletes on success, matching the extension", () => {
    // The extension mapped every DELETE_ORIGINAL_FILE value other than
    // "true"/"false" (unset included) to onSuccess.
    const resolved = resolveResizeImagesConfig({
      ...baseConfig,
      deleteOriginal: undefined,
    });
    expect(resolved.deleteOriginalFile).toEqual(DELETE_IMAGE.onSuccess);
  });

  test("an empty-string deleteOriginal (partial env) deletes on success", () => {
    const resolved = resolveResizeImagesConfig({
      ...baseConfig,
      deleteOriginal: "" as ResizeImagesConfig["deleteOriginal"],
    });
    expect(resolved.deleteOriginalFile).toEqual(DELETE_IMAGE.onSuccess);
  });

  test("splits a comma-separated sizes string", () => {
    const resolved = resolveResizeImagesConfig({
      ...baseConfig,
      sizes: "200x200,400x400",
    });
    expect(resolved.imageSizes).toEqual(["200x200", "400x400"]);
  });

  test("passes an array of sizes through untouched", () => {
    const resolved = resolveResizeImagesConfig({
      ...baseConfig,
      sizes: ["200x200", "60x60"],
    });
    expect(resolved.imageSizes).toEqual(["200x200", "60x60"]);
  });

  test("an unset sizes value yields no resize tasks instead of throwing", () => {
    // The extension calls `.split(",")` on the raw env var and throws a
    // TypeError at module load when IMG_SIZES is unset.
    const resolved = resolveResizeImagesConfig({
      ...baseConfig,
      sizes: undefined as unknown as string,
    });
    expect(resolved.imageSizes).toEqual([]);
  });

  test("defaults imageTypes to the no-conversion sentinel", () => {
    expect(resolveResizeImagesConfig(baseConfig).imageTypes).toEqual(["false"]);
  });

  test("splits a comma-separated imageTypes string", () => {
    const resolved = resolveResizeImagesConfig({
      ...baseConfig,
      imageTypes: "jpeg,webp",
    });
    expect(resolved.imageTypes).toEqual(["jpeg", "webp"]);
  });

  test("animated defaults to true and is forced on by sharpOptions", () => {
    expect(resolveResizeImagesConfig(baseConfig).animated).toBe(true);
    expect(
      resolveResizeImagesConfig({ ...baseConfig, isAnimated: false }).animated
    ).toBe(false);
    // An explicit `animated` in sharpOptions wins over isAnimated: false.
    expect(
      resolveResizeImagesConfig({
        ...baseConfig,
        isAnimated: false,
        sharpOptions: '{"animated":true}',
      }).animated
    ).toBe(true);
  });

  test("normalizes numeric memory values to MemoryOption strings", () => {
    expect(resolveResizeImagesConfig(baseConfig).memory).toBe("1GiB");
    expect(
      resolveResizeImagesConfig({ ...baseConfig, memory: 512 }).memory
    ).toBe("512MiB");
    expect(
      resolveResizeImagesConfig({ ...baseConfig, memory: 8192 }).memory
    ).toBe("8GiB");
    // Already-normalized values pass through.
    expect(
      resolveResizeImagesConfig({ ...baseConfig, memory: "2GiB" }).memory
    ).toBe("2GiB");
  });

  test("coerces empty optional strings to null", () => {
    const resolved = resolveResizeImagesConfig({
      ...baseConfig,
      customFilterPrompt: "",
      placeholderImagePath: "",
    });
    expect(resolved.customFilterPrompt).toBeNull();
    expect(resolved.placeholderImagePath).toBeNull();
  });

  test("regenerateToken and makePublic defaults", () => {
    const resolved = resolveResizeImagesConfig(baseConfig);
    expect(resolved.regenerateToken).toBe(true);
    expect(resolved.makePublic).toBe(false);
  });

  test("falls back to FUNCTION_REGION for the region", () => {
    process.env.FUNCTION_REGION = "europe-west1";
    expect(resolveResizeImagesConfig(baseConfig).region).toBe("europe-west1");
    expect(
      resolveResizeImagesConfig({ ...baseConfig, region: "us-central1" }).region
    ).toBe("us-central1");
  });
});

describe("convertHarmBlockThreshold", () => {
  test("OFF disables filtering", () => {
    expect(convertHarmBlockThreshold("OFF")).toBeNull();
    expect(resolveResizeImagesConfig(baseConfig).contentFilterLevel).toBeNull();
  });

  test("maps each supported threshold to itself", () => {
    for (const level of [
      "BLOCK_LOW_AND_ABOVE",
      "BLOCK_MEDIUM_AND_ABOVE",
      "BLOCK_ONLY_HIGH",
    ] as const) {
      expect(convertHarmBlockThreshold(level)).toBe(level);
    }
  });

  test("rejects BLOCK_NONE like the extension", () => {
    expect(() => convertHarmBlockThreshold("BLOCK_NONE" as never)).toThrow(
      "Invalid HarmBlockThreshold: BLOCK_NONE"
    );
    expect(() =>
      resolveResizeImagesConfig({
        ...baseConfig,
        contentFilterLevel: "BLOCK_NONE" as never,
      })
    ).toThrow("Invalid HarmBlockThreshold: BLOCK_NONE");
  });

  test("an unset level disables filtering", () => {
    expect(convertHarmBlockThreshold(undefined)).toBeNull();
  });

  test("throws for an unrecognised level", () => {
    expect(() =>
      convertHarmBlockThreshold("BLOCK_EVERYTHING" as never)
    ).toThrow("Invalid HarmBlockThreshold: BLOCK_EVERYTHING");
  });
});

describe("validateAbsolutePathList", () => {
  test("accepts a comma-separated list of absolute paths", () => {
    expect(
      validateAbsolutePathList(
        "/users/avatars,/design/pictures",
        "includePathList"
      )
    ).toEqual(["/users/avatars", "/design/pictures"]);
  });

  test("accepts an array and an undefined value", () => {
    expect(
      validateAbsolutePathList(["/users/avatars"], "includePathList")
    ).toEqual(["/users/avatars"]);
    expect(
      validateAbsolutePathList(undefined, "includePathList")
    ).toBeUndefined();
  });

  test("treats an empty string as unset", () => {
    expect(validateAbsolutePathList("", "excludePathList")).toBeUndefined();
  });

  test.each([
    ["a relative path", "users/avatars"],
    ["a whitespace-containing path", "/users/my avatars"],
    ["a trailing separator", "/users/avatars/"],
    ["one bad entry in a list", "/users/avatars,design/pictures"],
  ])("throws for %s", (_desc, value) => {
    expect(() => validateAbsolutePathList(value, "includePathList")).toThrow(
      "Invalid includePathList: must be a comma-separated list of absolute path values."
    );
  });

  test("names the offending param in the error", () => {
    expect(() => validateAbsolutePathList("nope", "excludePathList")).toThrow(
      /Invalid excludePathList/
    );
  });
});
