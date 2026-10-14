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

import { beforeAll, expect, test, vi } from "vitest";

const { requiresAPI } = vi.hoisted(() => ({ requiresAPI: vi.fn() }));

vi.mock("@google-cloud/speech", () => ({ SpeechClient: vi.fn(() => ({})) }));
vi.mock("firebase-functions/storage", () => ({
  onObjectFinalized: vi.fn(() => ({})),
}));
vi.mock("firebase-functions/v2", () => ({
  requiresAPI,
  requiresRole: vi.fn(),
}));

beforeAll(async () => {
  await import("../src/index");
});

test.each([
  [
    "firestore.googleapis.com",
    "Writes transcription results to Cloud Firestore.",
  ],
  [
    "speech.googleapis.com",
    "Used for transcribing audio files with Cloud Speech-to-Text.",
  ],
  [
    "eventarcpublishing.googleapis.com",
    "Publishes the extension's custom events to its Eventarc channel.",
  ],
])("declares %s", (api, reason) => {
  expect(requiresAPI).toHaveBeenCalledWith(api, reason);
});

test("declares exactly the 3 APIs the kit needs", () => {
  expect(requiresAPI).toHaveBeenCalledTimes(3);
});
