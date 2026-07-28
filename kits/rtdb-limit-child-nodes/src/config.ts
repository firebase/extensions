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
  nodePath: defineString("NODE_PATH"),
  maxCount: defineInt("MAX_COUNT"),
  databaseInstance: databaseInstanceDefault
    ? defineString("SELECTED_DATABASE_INSTANCE", {
        default: databaseInstanceDefault,
      })
    : defineString("SELECTED_DATABASE_INSTANCE"),
  region: defineString("LOCATION", { default: "us-central1" }),
};

export function configFromEnv(): RtdbLimitConfig {
  return {
    nodePath: params.nodePath.value(),
    maxCount: params.maxCount.value(),
    databaseInstance: params.databaseInstance.value(),
    region: params.region.value(),
  };
}

export function envDeployOptions(): DeployTimeOptions {
  return {
    ref: toTriggerRef(params.nodePath.value()),
    instance: params.databaseInstance.value(),
    region: params.region.value(),
  };
}
