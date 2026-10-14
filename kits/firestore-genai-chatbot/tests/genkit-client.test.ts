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

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@genkit-ai/firebase", () => ({ enableFirebaseTelemetry: vi.fn() }));

vi.mock("@genkit-ai/google-genai", () => {
  const pluginFactory = (name: string) =>
    Object.assign(
      vi.fn((options: unknown) => ({ plugin: name, options })),
      { model: vi.fn((model: string) => ({ name: `${name}/${model}` })) }
    );
  return {
    googleAI: pluginFactory("googleai"),
    vertexAI: pluginFactory("vertexai"),
  };
});

vi.mock("genkit", () => ({ genkit: vi.fn(() => ({ generate: vi.fn() })) }));

vi.mock("genkit/logging", () => ({ logger: { setLogLevel: vi.fn() } }));

import { vertexAI } from "@genkit-ai/google-genai";
import { GenerativeAIProvider, resolveConfig } from "../src/export-config";
import { GenkitDiscussionClient } from "../src/generative-client/genkit";

const baseInput = {
  projectId: "p",
  model: "gemini-2.5-flash",
  provider: GenerativeAIProvider.VERTEX_AI,
};

describe("GenkitDiscussionClient plugin registration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("registers the vertexai plugin against the function region", () => {
    vi.stubEnv("FUNCTION_REGION", "europe-west4");

    new GenkitDiscussionClient(resolveConfig(baseInput));

    expect(vertexAI).toHaveBeenCalledWith({ location: "europe-west4" });
  });

  test("registers an explicit location over the function region", () => {
    vi.stubEnv("FUNCTION_REGION", "europe-west4");

    new GenkitDiscussionClient(
      resolveConfig({ ...baseInput, vertexModelLocation: "global" })
    );

    expect(vertexAI).toHaveBeenCalledWith({ location: "global" });
  });

  // Off a deployed function there is no region to pass. Leaving the plugin's
  // location unset keeps its own `GCLOUD_LOCATION` handling in play.
  test("passes no location when no region resolves", () => {
    vi.stubEnv("FUNCTION_REGION", "");

    new GenkitDiscussionClient(resolveConfig(baseInput));

    // toHaveBeenCalledWith treats `{ location: undefined }` as `{}`, so the
    // omission has to be asserted on the call itself.
    expect(vi.mocked(vertexAI).mock.lastCall?.[0]).toStrictEqual({});
  });
});
