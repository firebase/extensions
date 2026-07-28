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

import type { Expression } from "firebase-functions/params";

const DEFAULT_REGION = "us-central1";

export interface RtdbLimitConfig {
  nodePath: string;
  maxCount: number;
  databaseInstance: string;
  region?: string;
}

export interface ResolvedRtdbLimitConfig {
  nodePath: string;
  maxCount: number;
  databaseInstance: string;
  region: string;
}

export interface DeployTimeOptions {
  ref: string | Expression<string>;
  instance: string | Expression<string>;
  region: string | Expression<string>;
}

function trimDatabasePath(path: string): string {
  return path.replace(/^\/+|\/+$/g, "");
}

export function resolveRtdbLimitConfig(
  config: RtdbLimitConfig
): ResolvedRtdbLimitConfig {
  const nodePath = trimDatabasePath(config.nodePath);
  const databaseInstance = config.databaseInstance.trim();

  if (!nodePath) {
    throw new Error("nodePath must be a non-empty Realtime Database path.");
  }

  if (!Number.isInteger(config.maxCount) || config.maxCount <= 0) {
    throw new Error("maxCount must be a positive integer.");
  }

  if (!databaseInstance) {
    throw new Error(
      "databaseInstance must be a non-empty Realtime Database instance."
    );
  }

  return {
    nodePath,
    maxCount: config.maxCount,
    databaseInstance,
    region: config.region?.trim() || DEFAULT_REGION,
  };
}

export function toTriggerRef(nodePath: string): string {
  return `${trimDatabasePath(nodePath)}/{nodeId}`;
}
