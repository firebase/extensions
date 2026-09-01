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

import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import { afterEach, describe, expect, test } from "vitest";
import {
  GenerativeAIProvider,
  getProjectId,
  resolveConfig,
} from "../src/export-config";

describe("resolveConfig", () => {
  const base = { projectId: "p", model: "gemini-2.5-flash" };

  test("applies defaults", () => {
    const c = resolveConfig(base);
    expect(c.provider).toBe(GenerativeAIProvider.GOOGLE_AI);
    expect(c.collectionName).toBe("generate");
    expect(c.promptField).toBe("prompt");
    expect(c.responseField).toBe("response");
    expect(c.orderField).toBe("createTime");
    expect(c.candidatesField).toBe("candidates");
    expect(c.candidateCount).toBe(1);
    expect(c.enableDiscussionOptionOverrides).toBe(false);
    expect(c.enableGenkitMonitoring).toBe(false);
    expect(c.safetySettings).toEqual([]);
  });

  test("keeps the vertex model location optional", () => {
    expect(resolveConfig(base).vertex.modelLocation).toBeUndefined();
    expect(
      resolveConfig({ ...base, vertexModelLocation: "europe-west2" }).vertex
        .modelLocation
    ).toBe("europe-west2");
  });

  test("nests model and apiKey under provider buckets", () => {
    const c = resolveConfig({ ...base, apiKey: "secret" });
    expect(c.vertex.model).toBe("gemini-2.5-flash");
    expect(c.googleAi.model).toBe("gemini-2.5-flash");
    expect(c.googleAi.apiKey).toBe("secret");
  });

  test("passes through explicit options", () => {
    const c = resolveConfig({
      ...base,
      provider: "vertex-ai",
      enableOverrides: true,
      candidateCount: 3,
      temperature: 0.5,
    });
    expect(c.provider).toBe(GenerativeAIProvider.VERTEX_AI);
    expect(c.enableDiscussionOptionOverrides).toBe(true);
    expect(c.candidateCount).toBe(3);
    expect(c.temperature).toBe(0.5);
  });

  test("accepts safety settings built from the SDK enums", () => {
    const c = resolveConfig({
      ...base,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
        },
      ],
    });
    expect(c.safetySettings).toEqual([
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_ONLY_HIGH",
      },
    ]);
  });

  test("rejects a safety setting category the SDK does not define", () => {
    expect(() =>
      resolveConfig({
        ...base,
        safetySettings: [
          { category: "HARM_CATEGORY_TYPO", threshold: "BLOCK_NONE" },
        ],
      })
    ).toThrow("Invalid safety setting category: HARM_CATEGORY_TYPO");
  });

  test("rejects a safety setting threshold the SDK does not define", () => {
    expect(() =>
      resolveConfig({
        ...base,
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: "BLOCK_EVERYTHING",
          },
        ],
      })
    ).toThrow("Invalid safety setting threshold: BLOCK_EVERYTHING");
  });

  test("validates against the Vertex AI enums when the provider is vertex-ai", () => {
    const vertexOnly = [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
    ];
    expect(
      resolveConfig({
        ...base,
        provider: "vertex-ai",
        safetySettings: vertexOnly,
      }).safetySettings
    ).toEqual(vertexOnly);
    expect(() =>
      resolveConfig({ ...base, safetySettings: vertexOnly })
    ).toThrow("Invalid safety setting threshold: OFF");
  });
});

describe("getProjectId", () => {
  const savedFirebaseConfig = process.env.FIREBASE_CONFIG;

  afterEach(() => {
    if (savedFirebaseConfig === undefined) {
      delete process.env.FIREBASE_CONFIG;
    } else {
      process.env.FIREBASE_CONFIG = savedFirebaseConfig;
    }
  });

  test("reads the project id from FIREBASE_CONFIG", () => {
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: "my-project" });
    expect(getProjectId()).toBe("my-project");
  });

  test("throws the extension's missing-var error when FIREBASE_CONFIG is not set", () => {
    delete process.env.FIREBASE_CONFIG;
    expect(getProjectId).toThrow(
      "Missing required environment variables: PROJECT_ID"
    );
  });

  test("throws the extension's missing-var error when FIREBASE_CONFIG has no project id", () => {
    process.env.FIREBASE_CONFIG = JSON.stringify({});
    expect(getProjectId).toThrow(
      "Missing required environment variables: PROJECT_ID"
    );
  });
});
