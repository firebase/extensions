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

/**
 * Whether this configuration asks for multiple candidate responses.
 *
 * The client-selection gate and the Firestore write path must agree: the Genkit
 * client only serves single-candidate configs, and writing the `candidates`
 * field requires a field name to write it to. Keeping one predicate stops the
 * two from drifting, which would either waste a multi-candidate request or send
 * a single-candidate config down the legacy clients.
 */
export function wantsMultipleCandidates(config: {
  candidateCount?: number;
  candidatesField?: string;
}): boolean {
  return (
    !!config.candidatesField &&
    !!config.candidateCount &&
    config.candidateCount > 1
  );
}
