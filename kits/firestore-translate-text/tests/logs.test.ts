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
import { messages } from "../src/logs/messages";

// The redaction lives in the message builders so no caller of `start`/`init`
// can log a credential, regardless of where the config picks the secret up.
describe("config log redaction", () => {
  test("start masks secret-shaped values and keeps the rest", () => {
    const [text, payload] = messages.start({
      collectionPath: "translations",
      googleAiApiKey: "super-secret",
      somePassword: "hunter2",
      accessToken: "tok",
      clientSecret: "sec",
      serviceCredential: "cred",
    });

    expect(text).toBe("Started execution of extension with configuration");
    expect(payload).toEqual({
      collectionPath: "translations",
      googleAiApiKey: "<omitted>",
      somePassword: "<omitted>",
      accessToken: "<omitted>",
      clientSecret: "<omitted>",
      serviceCredential: "<omitted>",
    });
    expect(JSON.stringify([text, payload])).not.toContain("super-secret");
  });

  test("init masks the Google AI API key only when it is set", () => {
    const [text, payload] = messages.init({
      collectionPath: "translations",
      googleAiApiKey: undefined,
    });

    expect(text).toBe("Initializing extension with the parameter values");
    expect(payload).toEqual({
      collectionPath: "translations",
      googleAiApiKey: undefined,
    });
  });

  test("an empty or null secret is not reported as omitted", () => {
    const [, payload] = messages.init({
      googleAiApiKey: "",
      accessToken: null,
    });

    expect(payload).toEqual({ googleAiApiKey: "", accessToken: null });
  });

  test("init masks the Google AI API key when it is set", () => {
    const [, payload] = messages.init({ googleAiApiKey: "super-secret" });

    expect(payload).toEqual({ googleAiApiKey: "<omitted>" });
  });

  test("redaction does not mutate the caller's config", () => {
    const config = { googleAiApiKey: "super-secret" };

    messages.start(config);

    expect(config.googleAiApiKey).toBe("super-secret");
  });
});
