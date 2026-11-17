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

import { describe, expect, test, vi } from "vitest";

const FUNCTIONS = ["clearData", "handleSearch", "handleDeletion"] as const;

async function loadKit() {
  vi.resetModules();
  return (await import("../src/index")) as Record<string, any>;
}

// The extension deployed to its install-time location, `us-central1` by
// default. With no region set the CLI would pick `us-east1` instead.
describe("function region", () => {
  test("is read from FUNCTION_DEFAULT_REGION, defaulting to us-central1", async () => {
    const kit = await loadKit();
    for (const name of FUNCTIONS) {
      const region = kit[name].__endpoint.region;
      expect(region.name).toBe("FUNCTION_DEFAULT_REGION");
      expect(region.options.default).toBe("us-central1");
    }
  });
});
