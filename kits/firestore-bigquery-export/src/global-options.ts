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

import { warn } from "firebase-functions/logger";
import * as functionsOptions from "firebase-functions/options";
import type { GlobalOptions } from "firebase-functions/options";

/** `getGlobalOptions` ships at runtime but is marked internal, so it is absent from the typings. */
const { getGlobalOptions } = functionsOptions as typeof functionsOptions & {
  getGlobalOptions?: () => GlobalOptions;
};

/** Warning logged when deploy discovery loads the kit before `defaultOptions` reached `setGlobalOptions`. */
export const DEFAULT_OPTIONS_MISSING_WARNING =
  "firestore-bigquery-export: no global cpu was set when the kit loaded, so its functions " +
  "deploy at the 2nd gen defaults (1 vCPU, concurrency 80) instead of the extension's 0.1666 vCPU. " +
  "Spread defaultOptions from @firebase-function-kits/firestore-bigquery-export/default-options " +
  "into setGlobalOptions before the kit is imported. In an ES module entry, call setGlobalOptions " +
  "in its own module and import that module first. See " +
  "https://github.com/firebase/extensions/tree/kits/kits/firestore-bigquery-export#concurrency-cpu-and-timeouts-match-the-extension";

/**
 * Logs {@link DEFAULT_OPTIONS_MISSING_WARNING} during deploy discovery when the
 * codebase's global options set no `cpu`, which means `defaultOptions` was not
 * applied before the kit's functions were defined.
 */
export function warnIfDefaultOptionsMissing(): void {
  // The Firebase CLI sets FUNCTIONS_CONTROL_API only in the discovery process.
  if (process.env.FUNCTIONS_CONTROL_API !== "true" || !getGlobalOptions) {
    return;
  }
  if (getGlobalOptions().cpu === undefined) {
    warn(DEFAULT_OPTIONS_MISSING_WARNING);
  }
}
