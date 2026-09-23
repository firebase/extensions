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

import type { GlobalOptions } from "firebase-functions/options";

/**
 * Global options that reproduce the extension's runtime shape: one request per
 * 0.1666 vCPU instance, up to 100 instances. Spread into your codebase's single
 * `setGlobalOptions` call, before your own keys so they override these:
 *
 * ```ts
 * setGlobalOptions({ ...defaultOptions, region: "europe-west1" });
 * ```
 *
 * Importing this module has no side effects, so it is safe to import before
 * `setGlobalOptions` runs.
 */
export const defaultOptions = {
  cpu: "gcf_gen1",
  concurrency: 1,
  maxInstances: 100,
} as const satisfies GlobalOptions;
