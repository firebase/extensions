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

import { logger } from "firebase-functions";
import type { ResolvedVectorSearchConfig } from "./export-config";

export function init(config: ResolvedVectorSearchConfig): void {
  logger.log("Initializing extension with configuration", {
    ...config,
    geminiApiKey: config.geminiApiKey ? "<omitted>" : undefined,
    openAiApiKey: config.openAiApiKey ? "<omitted>" : undefined,
  });
}

export function start(operation: string): void {
  logger.log(`Started firestore-vector-search ${operation}`);
}

export function complete(operation: string): void {
  logger.log(`Completed firestore-vector-search ${operation}`);
}

export function error(operation: string, err: unknown): void {
  logger.error(`Failed firestore-vector-search ${operation}`, err);
}
