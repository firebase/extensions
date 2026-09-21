/*
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

import { RESET_VALUE } from "firebase-functions/v2/options";
import { describe, expect, test, vi } from "vitest";

// The deploy entry resolves the instance id when it loads.
vi.hoisted(() => {
  process.env.FIREBASE_KIT_INSTANCE_ID = "test-instance";
});

import { processMessages, upsertTransferConfig } from "../src/index";

describe("deploy options", () => {
  test("processMessages serves one message per instance and takes internal traffic only", () => {
    expect(processMessages.__endpoint.concurrency).toBe(1);
    expect(processMessages.__endpoint.ingressSettings).toBe(
      "ALLOW_INTERNAL_ONLY"
    );
  });

  test("upsertTransferConfig serves one task per instance and keeps the default open ingress", () => {
    expect(upsertTransferConfig.__endpoint.concurrency).toBe(1);
    expect(upsertTransferConfig.__endpoint.ingressSettings).toBe(RESET_VALUE);
  });
});
