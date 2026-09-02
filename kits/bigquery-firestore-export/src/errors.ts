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
 * A deploy-time misconfiguration that no retry can resolve. Cloud Tasks retries
 * every non-2xx response, so the upsert task handler reports these and returns
 * rather than throwing. The message must name the misconfiguration and the
 * action the user has to take.
 */
export class PermanentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentConfigurationError";
  }
}
