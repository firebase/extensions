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

import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

// The README promises `./lib` reads no environment when it loads, so it can be
// imported from a user's own triggers and tests outside the Firebase CLI.
test("the library entry loads without FIREBASE_KIT_INSTANCE_ID", async () => {
  vi.resetModules();
  vi.stubEnv("FIREBASE_KIT_INSTANCE_ID", undefined);

  const lib = await import("../src/lib");

  expect(lib.configFromEnv).toBeTypeOf("function");
  expect(lib.resolveVectorSearchConfig).toBeTypeOf("function");
});
