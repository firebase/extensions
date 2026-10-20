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
import { setGlobalOptions } from "firebase-functions/v2";

const FUNCTIONS = ["clearData", "handleSearch", "handleDeletion"] as const;

async function loadKit() {
  vi.resetModules();
  return (await import("../src/index")) as Record<string, any>;
}

// The README tells users to pick a region with setGlobalOptions({ region })
// before the kit loads, so the kit must not pin a region of its own.
describe("function region", () => {
  test("is not set by the kit, so the CLI default applies", async () => {
    const kit = await loadKit();
    for (const name of FUNCTIONS) {
      expect(kit[name].__endpoint.region).toBeUndefined();
    }
  });

  test("follows setGlobalOptions called before the kit loads", async () => {
    setGlobalOptions({ region: "europe-west1" });
    const kit = await loadKit();
    for (const name of FUNCTIONS) {
      expect(kit[name].__endpoint.region).toEqual(["europe-west1"]);
    }
  });
});
