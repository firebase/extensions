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

import { getFunctions } from "firebase-admin/functions";
import type { ResolvedCaptureConfig } from "./capture-config";

/** Names of the deployed task-queue functions. */
export const CHANGELOG_TASK_FUNCTION = "syncChangelogTask";
export const RESTORATION_TASK_FUNCTION = "runRestorationTask";

/**
 * Builds the fully-qualified task queue name for a deployed function.
 *
 * @param config - The resolved capture configuration.
 * @param functionName - The deployed function's name.
 * @returns The queue resource name.
 */
export function queueName(
  config: ResolvedCaptureConfig,
  functionName: string
): string {
  return `locations/${config.location}/functions/${functionName}`;
}

/**
 * Enqueues a payload onto a deployed function's task queue.
 *
 * @param config - The resolved capture configuration.
 * @param functionName - The deployed function's name.
 * @param payload - The task payload.
 */
export async function enqueue(
  config: ResolvedCaptureConfig,
  functionName: string,
  payload: object
): Promise<void> {
  await getFunctions()
    .taskQueue(queueName(config, functionName))
    .enqueue(payload);
}
