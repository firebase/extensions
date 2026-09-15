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

import { defineString, storageBucket } from "firebase-functions/params";
import type { BundleBuilderConfig } from "./export-config";

/**
 * Deploy-time parameters. Set these via a `.env` / `.env.<project>` file or the
 * interactive prompts shown by `firebase deploy`. The env var names match the
 * legacy extension so a migrating customer's `.env` is a lift-and-shift.
 *
 * @see https://firebase.google.com/docs/functions/config-env
 */
const params = {
  bundleSpecCollection: defineString("BUNDLESPEC_COLLECTION", {
    default: "bundles",
    // `required: true` in the extension, which refuses an empty answer.
    input: { text: { example: "bundles", nonEmpty: true } },
  }),
  bundleStorageBucket: defineString("BUNDLE_STORAGE_BUCKET", {
    default: storageBucket,
    // Extension regex, kept verbatim. The param is optional there and the
    // regex already matches the empty string, so no empty branch is needed.
    input: {
      text: {
        example: "my-project-12345.appspot.com",
        validationRegex: /^([0-9a-z_.-]*)$/,
        validationErrorMessage: "Invalid storage bucket",
      },
    },
  }),
  storagePrefix: defineString("STORAGE_PREFIX", { default: "bundles" }),
};

/**
 * Resolves all deploy-time params into a {@link BundleBuilderConfig}.
 *
 * @returns The bundle builder configuration assembled from environment params.
 */
export function configFromEnv(): BundleBuilderConfig {
  return {
    bundleSpecCollection: params.bundleSpecCollection.value(),
    bundleStorageBucket: params.bundleStorageBucket.value() || undefined,
    storagePrefix: params.storagePrefix.value(),
  };
}

// Params the published extension marks `required: true`. A value the user never
// supplied is absent from process.env; one they deliberately blanked is present
// and empty. Only the second is a misconfiguration, so the guard below reads
// process.env rather than `.value()`, which reports both as "".
const REQUIRED_PARAMS = ["BUNDLESPEC_COLLECTION"] as const;

/**
 * Rejects required params that were explicitly set to an empty value.
 *
 * `.env` values bypass the CLI's prompt-time validation and take precedence
 * over a param's declared default, so an empty entry otherwise reaches the
 * handlers silently. Called at module scope so deploy-time discovery fails
 * before the function ships, rather than on the first event.
 */
export function assertRequiredParams(
  names: ReadonlyArray<string> = REQUIRED_PARAMS
): void {
  const blank = names.filter((name) => {
    const raw = process.env[name];
    return raw !== undefined && raw.trim() === "";
  });

  if (blank.length > 0) {
    throw new Error(
      `Required parameters are set to an empty value: ${blank.join(", ")}. ` +
        "Set them in your .env file, or remove the entries to use their defaults."
    );
  }
}
