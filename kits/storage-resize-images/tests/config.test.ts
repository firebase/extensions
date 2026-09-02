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
 * The environment-facing half of the extension's `config.test.ts`. The
 * extension reads `process.env` directly at module load; the kit reads the
 * same variables through `firebase-functions/params`.
 *
 * Note that param *defaults* are a deploy-time concern — the Firebase CLI
 * bakes them into the deployed `.env`, and at runtime `.value()` only reads
 * `process.env`. So the environment here is written the way the CLI would
 * write it, including `IMAGE_TYPE` as a JSON array (the extension reads that
 * same variable as a comma-separated string).
 */

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type {
  ListParam,
  MultiSelectInput,
  SelectInput,
  StringParam,
} from "firebase-functions/params";
import type { ContentFilterLevel } from "../src/export-config";

const ENV_KEYS = [
  "IMG_BUCKET",
  "IMG_SIZES",
  "DELETE_ORIGINAL_FILE",
  "MAKE_PUBLIC",
  "RESIZED_IMAGES_PATH",
  "INCLUDE_PATH_LIST",
  "EXCLUDE_PATH_LIST",
  "FAILED_IMAGES_PATH",
  "CACHE_CONTROL_HEADER",
  "IMAGE_TYPE",
  "OUTPUT_OPTIONS",
  "SHARP_OPTIONS",
  "IS_ANIMATED",
  "FUNCTION_MEMORY",
  "REGENERATE_TOKEN",
  "CONTENT_FILTER_LEVEL",
  "CUSTOM_FILTER_PROMPT",
  "PLACEHOLDER_IMAGE_PATH",
  "FUNCTION_REGION",
  "FIREBASE_CONFIG",
] as const;

/** Mirrors the extension's test environment, as the CLI would write it. */
const environment: Record<string, string> = {
  IMG_BUCKET: "extensions-testing.appspot.com",
  IMG_SIZES: "200x200",
  DELETE_ORIGINAL_FILE: "true",
  CONTENT_FILTER_LEVEL: "OFF",
  IMAGE_TYPE: '["false"]',
  SHARP_OPTIONS: "{}",
  IS_ANIMATED: "true",
  FUNCTION_MEMORY: "1024",
  REGENERATE_TOKEN: "true",
  MAKE_PUBLIC: "false",
  FUNCTION_REGION: "us-central1",
  // `projectID` resolves out of FIREBASE_CONFIG, which the runtime injects.
  FIREBASE_CONFIG: '{"projectId":"extensions-testing"}',
};

describe("configFromEnv", () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
    Object.assign(process.env, environment);
  });

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    saved.clear();
  });

  test("reads the same environment variables as the extension", async () => {
    const { configFromEnv } = await import("../src/config");
    const config = configFromEnv();

    expect(config.bucket).toBe("extensions-testing.appspot.com");
    expect(config.sizes).toBe("200x200");
    expect(config.deleteOriginal).toBe("true");
    expect(config.contentFilterLevel).toBe("OFF");
    expect(config.region).toBe("us-central1");
    expect(config.projectId).toBe("extensions-testing");
  });

  test("collapses unset optional strings to undefined", async () => {
    const { configFromEnv } = await import("../src/config");
    const config = configFromEnv();

    expect(config.resizedImagesPath).toBeUndefined();
    expect(config.includePathList).toBeUndefined();
    expect(config.excludePathList).toBeUndefined();
    expect(config.failedImagesPath).toBeUndefined();
    expect(config.cacheControlHeader).toBeUndefined();
    expect(config.outputOptions).toBeUndefined();
    expect(config.customFilterPrompt).toBeUndefined();
    expect(config.placeholderImagePath).toBeUndefined();
  });

  test("reads the deployed defaults the CLI writes into the environment", async () => {
    const { configFromEnv } = await import("../src/config");
    const config = configFromEnv();

    expect(config.imageTypes).toEqual(["false"]);
    expect(config.sharpOptions).toBe("{}");
    expect(config.isAnimated).toBe(true);
    expect(config.regenerateToken).toBe(true);
    expect(config.makePublic).toBe(false);
    expect(config.memory).toBe(1024);
  });

  test("param defaults do not apply at runtime when a var is missing", async () => {
    // Not aspirational — this documents the `firebase-functions/params`
    // runtime contract. `.value()` reads only `process.env`; the declared
    // `default:` is written into the deployed `.env` by the CLI. A hand-rolled
    // or partial `.env` therefore yields these values, not the declared ones.
    delete process.env.IS_ANIMATED;
    delete process.env.REGENERATE_TOKEN;
    delete process.env.FUNCTION_MEMORY;
    delete process.env.SHARP_OPTIONS;

    const { configFromEnv } = await import("../src/config");
    const config = configFromEnv();

    expect(config.isAnimated).toBe(false);
    expect(config.regenerateToken).toBe(false);
    expect(config.memory).toBe(0);
    expect(config.sharpOptions).toBe("");
  });

  test("a missing IMAGE_TYPE throws instead of falling back to its default", async () => {
    // The list param JSON-parses the raw env var, so an absent IMAGE_TYPE is
    // a cold-start crash — the kit's counterpart to the extension's
    // `IMG_SIZES.split(",")` TypeError on a missing variable.
    delete process.env.IMAGE_TYPE;

    const { configFromEnv } = await import("../src/config");
    expect(() => configFromEnv()).toThrow(SyntaxError);
  });

  test("IMAGE_TYPE is read as a JSON array, not a comma-separated string", async () => {
    // The extension reads the same variable with `.split(",")`, so an
    // extension-style value does not carry over.
    process.env.IMAGE_TYPE = "jpeg,webp";
    const { configFromEnv } = await import("../src/config");
    expect(() => configFromEnv()).toThrow(SyntaxError);

    process.env.IMAGE_TYPE = '["jpeg","webp"]';
    expect(configFromEnv().imageTypes).toEqual(["jpeg", "webp"]);
  });

  test("reads explicit values for every param", async () => {
    Object.assign(process.env, {
      IMG_SIZES: "200x200,400x400",
      DELETE_ORIGINAL_FILE: "on_success",
      MAKE_PUBLIC: "true",
      RESIZED_IMAGES_PATH: "thumbs",
      INCLUDE_PATH_LIST: "/users/avatars",
      EXCLUDE_PATH_LIST: "/users/avatars/thumbs",
      FAILED_IMAGES_PATH: "failed",
      CACHE_CONTROL_HEADER: "max-age=3600",
      IMAGE_TYPE: '["jpeg","webp"]',
      OUTPUT_OPTIONS: '{"jpeg":{"quality":80}}',
      SHARP_OPTIONS: '{"animated":true}',
      IS_ANIMATED: "false",
      FUNCTION_MEMORY: "2048",
      REGENERATE_TOKEN: "false",
      CONTENT_FILTER_LEVEL: "BLOCK_ONLY_HIGH",
      CUSTOM_FILTER_PROMPT: "Is this image appropriate?",
      PLACEHOLDER_IMAGE_PATH: "placeholder.png",
    });

    const { configFromEnv } = await import("../src/config");
    const config = configFromEnv();

    expect(config).toMatchObject({
      sizes: "200x200,400x400",
      deleteOriginal: "on_success",
      makePublic: true,
      resizedImagesPath: "thumbs",
      includePathList: "/users/avatars",
      excludePathList: "/users/avatars/thumbs",
      failedImagesPath: "failed",
      cacheControlHeader: "max-age=3600",
      imageTypes: ["jpeg", "webp"],
      outputOptions: '{"jpeg":{"quality":80}}',
      sharpOptions: '{"animated":true}',
      isAnimated: false,
      memory: 2048,
      regenerateToken: false,
      contentFilterLevel: "BLOCK_ONLY_HIGH",
      customFilterPrompt: "Is this image appropriate?",
      placeholderImagePath: "placeholder.png",
    });
  });
});

/**
 * The select is the only source of CONTENT_FILTER_LEVEL values at deploy
 * time, so every option it offers must be a value the resolver accepts.
 */
describe("CONTENT_FILTER_LEVEL select", () => {
  const baseConfig = {
    bucket: "extensions-testing.appspot.com",
    sizes: "200x200",
  } as const;

  async function selectOptions() {
    await import("../src/config");
    const { declaredParams } = await import("firebase-functions/params");
    const param = declaredParams.find(
      (declared) => declared.name === "CONTENT_FILTER_LEVEL"
    ) as StringParam | undefined;
    const input = param?.options.input as SelectInput<string> | undefined;
    return input?.select.options ?? [];
  }

  test("offers OFF and the three block thresholds", async () => {
    expect(await selectOptions()).toEqual([
      { label: "Off (No filtering)", value: "OFF" },
      {
        label: "Low strictness (Block only high severity content)",
        value: "BLOCK_ONLY_HIGH",
      },
      {
        label: "Medium strictness (Block medium and high severity content)",
        value: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        label: "High strictness (Block low, medium, and high severity content)",
        value: "BLOCK_LOW_AND_ABOVE",
      },
    ]);
  });

  test("every option resolves, and OFF disables filtering", async () => {
    const { resolveResizeImagesConfig } = await import("../src/export-config");
    for (const { value } of await selectOptions()) {
      const resolved = resolveResizeImagesConfig({
        ...baseConfig,
        contentFilterLevel: value as ContentFilterLevel,
      });
      if (value === "OFF") {
        expect(resolved.contentFilterLevel).toBeNull();
      } else {
        expect(resolved.contentFilterLevel).toBe(value);
      }
    }
  });

  test('the retired "False" option value is rejected', async () => {
    const { resolveResizeImagesConfig } = await import("../src/export-config");
    expect(() =>
      resolveResizeImagesConfig({
        ...baseConfig,
        contentFilterLevel: "False" as never,
      })
    ).toThrow("Invalid HarmBlockThreshold: False");
  });
});

/**
 * The same audit for IMAGE_TYPE: every multiSelect value must be one the
 * resize path accepts - `"false"` for keeping the original format, or a key
 * of `SUPPORTED_IMAGE_CONTENT_TYPE_MAP` so the output content type resolves.
 */
describe("IMAGE_TYPE multiSelect", () => {
  async function multiSelectOptions() {
    await import("../src/config");
    const { declaredParams } = await import("firebase-functions/params");
    const param = declaredParams.find(
      (declared) => declared.name === "IMAGE_TYPE"
    ) as ListParam | undefined;
    const input = param?.options.input as MultiSelectInput | undefined;
    return input?.multiSelect.options ?? [];
  }

  test('offers the six conversion formats and "false" for the original type', async () => {
    expect(await multiSelectOptions()).toEqual([
      { label: "jpeg", value: "jpeg" },
      { label: "webp", value: "webp" },
      { label: "png", value: "png" },
      { label: "tiff", value: "tiff" },
      { label: "gif", value: "gif" },
      { label: "avif", value: "avif" },
      { label: "original", value: "false" },
    ]);
  });

  test("every conversion value maps to an output content type", async () => {
    const { SUPPORTED_IMAGE_CONTENT_TYPE_MAP } = await import("../src/global");
    for (const { value } of await multiSelectOptions()) {
      if (value !== "false") {
        expect(SUPPORTED_IMAGE_CONTENT_TYPE_MAP).toHaveProperty(value);
      }
    }
  });
});

/**
 * The extension enforces path-list shape at install time via the
 * `extension.yaml` param regex. The kit has no install step, so the same
 * guard runs at module load and must reject the same values.
 */
describe("validatePathListsFromEnv", () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of ["INCLUDE_PATH_LIST", "EXCLUDE_PATH_LIST"] as const) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    saved.clear();
  });

  test("accepts an unset environment", async () => {
    const { validatePathListsFromEnv } = await import("../src/config");
    expect(() => validatePathListsFromEnv()).not.toThrow();
  });

  test("accepts empty strings and valid absolute lists", async () => {
    process.env.INCLUDE_PATH_LIST = "";
    process.env.EXCLUDE_PATH_LIST = "/users/avatars/thumbs,/design/thumbs";

    const { validatePathListsFromEnv } = await import("../src/config");
    expect(() => validatePathListsFromEnv()).not.toThrow();
  });

  test("throws on a malformed INCLUDE_PATH_LIST", async () => {
    process.env.INCLUDE_PATH_LIST = "users/avatars";

    const { validatePathListsFromEnv } = await import("../src/config");
    expect(() => validatePathListsFromEnv()).toThrow(/Invalid includePathList/);
  });

  test("throws on a malformed EXCLUDE_PATH_LIST", async () => {
    process.env.EXCLUDE_PATH_LIST = "/users/my avatars";

    const { validatePathListsFromEnv } = await import("../src/config");
    expect(() => validatePathListsFromEnv()).toThrow(/Invalid excludePathList/);
  });
});
