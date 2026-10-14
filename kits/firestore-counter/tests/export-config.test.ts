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
import {
  type CounterConfig,
  resolveCounterConfig,
  scheduleExpression,
} from "../src/export-config";

const config: CounterConfig = {
  internalStatePath: "_firebase_ext_/sharded_counter",
  scheduleFrequencyMinutes: 1,
};

describe("resolveCounterConfig", () => {
  test("passes the caller's configuration through", () => {
    expect(resolveCounterConfig(config)).toEqual(config);
  });

  test("accepts a custom internal state path and frequency", () => {
    expect(
      resolveCounterConfig({
        internalStatePath: "internal/counter_state",
        scheduleFrequencyMinutes: 5,
      })
    ).toEqual({
      internalStatePath: "internal/counter_state",
      scheduleFrequencyMinutes: 5,
    });
  });
});

describe("scheduleExpression", () => {
  test("builds an App Engine cron expression", () => {
    expect(scheduleExpression(resolveCounterConfig(config))).toBe(
      "every 1 minutes"
    );
  });

  test("reflects a custom frequency", () => {
    expect(
      scheduleExpression(
        resolveCounterConfig({ ...config, scheduleFrequencyMinutes: 10 })
      )
    ).toBe("every 10 minutes");
  });
});
