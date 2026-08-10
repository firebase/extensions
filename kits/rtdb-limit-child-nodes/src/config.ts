/*
 * Copyright 2019 Google LLC
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

import { defineInt, defineString } from "firebase-functions/params";
import type { DeployTimeOptions, RtdbLimitConfig } from "./export-config";
import { toTriggerRef } from "./export-config";

function defaultDatabaseInstance(): string | undefined {
  try {
    const config = JSON.parse(process.env.FIREBASE_CONFIG ?? "{}") as {
      databaseURL?: string;
    };
    return config.databaseURL
      ? new URL(config.databaseURL).hostname.split(".")[0]
      : undefined;
  } catch {
    return undefined;
  }
}

const databaseInstanceDefault = defaultDatabaseInstance();

const params = {
  // Do not use NODE_PATH: Node.js reserves it for module resolution and will
  // overwrite the param at runtime (and can freeze a bad ref at deploy).
  nodePath: defineString("RTDB_NODE_PATH", { default: "messages" }),
  maxCount: defineInt("MAX_COUNT", { default: 100 }),
  databaseInstance: databaseInstanceDefault
    ? defineString("SELECTED_DATABASE_INSTANCE", {
        default: databaseInstanceDefault,
      })
    : defineString("SELECTED_DATABASE_INSTANCE"),
};

export function configFromEnv(): RtdbLimitConfig {
  return {
    nodePath: params.nodePath.value(),
    maxCount: params.maxCount.value(),
    databaseInstance: params.databaseInstance.value(),
  };
}

/**
 * Builds deploy-time trigger options.
 *
 * `ref` must be a concrete string: `onValueCreated` calls `normalizePath(ref)`
 * at module load and does not accept Expressions (unlike Firestore `document`).
 * Do not use `params.nodePath.value()` here — during CLI discovery `.value()`
 * resolves to "" (defaults are runtime-only), which freezes ref as `{nodeId}`.
 * Read `process.env` (CLI injects `.env.<project>` before load) with fallback.
 * `instance` stays an Expression so the CLI resolves it after discovery.
 */
export function envDeployOptions(): DeployTimeOptions {
  const nodePath = (process.env.RTDB_NODE_PATH ?? "").trim() || "messages";
  return {
    ref: toTriggerRef(nodePath),
    instance: params.databaseInstance,
  };
}
