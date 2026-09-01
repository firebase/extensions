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

/**
 * Names the functions are exported under. The CLI renames them on deploy - see
 * {@link queueName}.
 */
export const CHANGELOG_TASK_FUNCTION = "syncChangelogTask";
export const RESTORATION_TASK_FUNCTION = "runRestorationTask";

/**
 * Builds the fully-qualified task queue name for a deployed function.
 *
 * A kit stanza deploys every function under `kit-<instance id>-<export name>`,
 * so the queue to enqueue onto is not named after the export. `instanceId` must
 * match this instance's key in the `instances` map for the name to resolve;
 * a mismatch enqueues onto a queue that does not exist.
 *
 * @param config - The resolved capture configuration.
 * @param functionName - The name the function is exported under.
 * @returns The queue resource name.
 */
export function queueName(
  config: ResolvedCaptureConfig,
  functionName: string
): string {
  const region = config.location || process.env.FUNCTION_REGION;

  if (!region) {
    throw new Error("A region is required to resolve task queues.");
  }

  return `locations/${region}/functions/kit-${config.instanceId}-${functionName}`;
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
