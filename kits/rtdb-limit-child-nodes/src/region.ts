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
 * Normalizes a Realtime Database instance location into the Cloud Run region
 * the function should deploy to. Database locations are Cloud Run regions
 * already, so there is nothing to map; the lookup only trims and lowercases,
 * as the CLI's own region handling does. An unset or blank location returns
 * `undefined`, meaning the function declares no region.
 */
export function normalizeRegion(
  location: string | undefined
): string | undefined {
  const normalized = location?.trim().toLowerCase();

  return normalized || undefined;
}
