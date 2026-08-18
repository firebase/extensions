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

import {
  convertHarmBlockThreshold,
  DELETE_IMAGE,
  resolveResizeImagesConfig,
  validateAbsolutePathList,
} from "../src/export-config";

const base = { bucket: "extensions-testing.appspot.com", sizes: "200x200" };

describe("resolveResizeImagesConfig", () => {
  test("applies defaults for optional fields", () => {
    const resolved = resolveResizeImagesConfig(base);

    expect(resolved).toMatchObject({
      bucket: "extensions-testing.appspot.com",
      imageSizes: ["200x200"],
      deleteOriginalFile: DELETE_IMAGE.never,
      makePublic: false,
      imageTypes: ["false"],
      sharpOptions: "{}",
      animated: true,
      memory: "1GiB",
      regenerateToken: true,
      contentFilterLevel: null,
      customFilterPrompt: null,
      placeholderImagePath: null,
    });
  });

  test("splits comma-separated sizes and image types", () => {
    const resolved = resolveResizeImagesConfig({
      ...base,
      sizes: "200x200,400x400",
      imageTypes: "jpeg,webp",
    });

    expect(resolved.imageSizes).toEqual(["200x200", "400x400"]);
    expect(resolved.imageTypes).toEqual(["jpeg", "webp"]);
  });

  test.each([
    ["true", DELETE_IMAGE.always],
    [true, DELETE_IMAGE.always],
    ["false", DELETE_IMAGE.never],
    [false, DELETE_IMAGE.never],
    [undefined, DELETE_IMAGE.never],
    ["on_success", DELETE_IMAGE.onSuccess],
  ] as const)("maps deleteOriginal %s", (deleteOriginal, expected) => {
    expect(
      resolveResizeImagesConfig({ ...base, deleteOriginal }).deleteOriginalFile
    ).toBe(expected);
  });

  test("maps the memory param onto a function memory option", () => {
    expect(resolveResizeImagesConfig({ ...base, memory: 512 }).memory).toBe(
      "512MiB"
    );
    expect(resolveResizeImagesConfig({ ...base, memory: 8192 }).memory).toBe(
      "8GiB"
    );
  });

  test("treats animated sharp options as animated even when the param is off", () => {
    expect(
      resolveResizeImagesConfig({
        ...base,
        isAnimated: false,
        sharpOptions: '{"animated":true}',
      }).animated
    ).toBe(true);
    expect(
      resolveResizeImagesConfig({ ...base, isAnimated: false }).animated
    ).toBe(false);
  });

  test("rejects a path list that is not absolute", () => {
    expect(() =>
      resolveResizeImagesConfig({ ...base, includePathList: "relative/path" })
    ).toThrow("Invalid includePathList");
    expect(() =>
      resolveResizeImagesConfig({ ...base, excludePathList: "relative/path" })
    ).toThrow("Invalid excludePathList");
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

  test("treats an empty value as unset", () => {
    expect(validateAbsolutePathList("", "includePathList")).toBeUndefined();
    expect(
      validateAbsolutePathList(undefined, "includePathList")
    ).toBeUndefined();
  });
});

describe("convertHarmBlockThreshold", () => {
  test("maps OFF to no filtering", () => {
    expect(convertHarmBlockThreshold("OFF")).toBeNull();
    expect(convertHarmBlockThreshold(undefined)).toBeNull();
  });

  test("passes the Vertex AI thresholds through", () => {
    expect(convertHarmBlockThreshold("BLOCK_ONLY_HIGH")).toBe(
      "BLOCK_ONLY_HIGH"
    );
    expect(convertHarmBlockThreshold("BLOCK_LOW_AND_ABOVE")).toBe(
      "BLOCK_LOW_AND_ABOVE"
    );
  });
});
