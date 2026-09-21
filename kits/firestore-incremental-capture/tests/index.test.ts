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
import { expect, test } from "vitest";
import {
  initIncrementalCapture,
  onHttpRunRestoration,
  runRestorationTask,
  syncChangelogTask,
  syncData,
} from "../src/index";

test("onHttpRunRestoration deploys with a private invoker", () => {
  expect(onHttpRunRestoration.__endpoint.httpsTrigger).toMatchObject({
    invoker: ["private"],
  });
});

test("every function serves one invocation per instance", () => {
  for (const fn of [
    syncData,
    syncChangelogTask,
    onHttpRunRestoration,
    runRestorationTask,
    initIncrementalCapture,
  ]) {
    expect(fn.__endpoint.concurrency).toBe(1);
  }
});

test("syncData takes internal traffic only", () => {
  expect(syncData.__endpoint.ingressSettings).toBe("ALLOW_INTERNAL_ONLY");
});

test("the task queues and the HTTPS endpoint keep the default open ingress", () => {
  for (const fn of [
    syncChangelogTask,
    onHttpRunRestoration,
    runRestorationTask,
    initIncrementalCapture,
  ]) {
    expect(fn.__endpoint.ingressSettings).toBe(RESET_VALUE);
  }
});
