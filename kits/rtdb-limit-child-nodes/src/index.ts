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

import { getApps, initializeApp } from "firebase-admin/app";
import {
  onValueCreated,
  type ReferenceOptions,
} from "firebase-functions/database";
import type { Role } from "firebase-functions/v2";
import { requiresRole } from "firebase-functions/v2";
import { configFromEnv, envDeployOptions } from "./config";
import type { ResolvedRtdbLimitConfig } from "./export-config";
import { resolveRtdbLimitConfig } from "./export-config";
import { handleChildCreated } from "./handlers";
import * as logs from "./logs";

export * from "./lib";

const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/firebasedatabase.admin",
  // Gen2 RTDB triggers need Eventarc receive on the function SA.
  "roles/eventarc.eventReceiver",
];

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

const deploy = envDeployOptions();

let config: ResolvedRtdbLimitConfig | null = null;

function getConfig(): ResolvedRtdbLimitConfig {
  if (getApps().length === 0) {
    initializeApp();
  }

  if (!config) {
    config = resolveRtdbLimitConfig(configFromEnv());
    logs.init(config);
  }

  return config;
}

export const rtdblimit = onValueCreated(
  {
    region: deploy.region,
    ref: deploy.ref,
    instance: deploy.instance,
  } as ReferenceOptions,
  (event) => handleChildCreated(event, { config: getConfig() })
);
