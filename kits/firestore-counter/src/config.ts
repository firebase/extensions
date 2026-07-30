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

import type { Expression } from "firebase-functions/params";
import { defineString, expr } from "firebase-functions/params";
import type { CounterConfig } from "./export-config";

type ConfigExpression<T extends string | number | boolean> = Expression<T>;

export interface ConfigExpressions {
  internalStatePath: ConfigExpression<string>;
  region: ConfigExpression<string>;
  schedule: ConfigExpression<string>;
}

const params = {
  internalStatePath: defineString("INTERNAL_STATE_PATH", {
    default: "_firebase_ext_/sharded_counter",
  }),
  scheduleFrequencyMinutes: defineString("SCHEDULE_FREQUENCY", {
    default: "1",
  }),
  region: defineString("LOCATION", { default: "us-central1" }),
};

export const CONFIG_EXPRESSIONS: ConfigExpressions = {
  internalStatePath: params.internalStatePath,
  region: params.region,
  schedule: expr`every ${params.scheduleFrequencyMinutes} minutes`,
};

export function configFromEnv(): CounterConfig {
  return {
    internalStatePath: params.internalStatePath.value(),
    scheduleFrequencyMinutes: Number(params.scheduleFrequencyMinutes.value()),
    region: params.region.value(),
  };
}
