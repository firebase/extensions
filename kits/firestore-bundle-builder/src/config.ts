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
import type { BundleBuilderConfig, DeployTimeOptions } from "./export-config";

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
  }),
  bundleStorageBucket: defineString("BUNDLE_STORAGE_BUCKET", {
    default: storageBucket,
  }),
  storagePrefix: defineString("STORAGE_PREFIX", { default: "bundles" }),
  location: defineString("LOCATION", { default: "us-central1" }),
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
    region: params.location.value(),
  };
}

/**
 * Builds the {@link DeployTimeOptions} for the params-driven entry point.
 *
 * Unlike {@link configFromEnv}, this never calls `.value()`: it passes the
 * region param object through as a CEL {@link Expression} so the function's
 * region appears in the deploy manifest as `{{ params.LOCATION }}`, which the
 * Firebase CLI resolves after loading `.env` / prompting. Calling `.value()`
 * here would freeze the deploy-time default (`us-central1`) into the manifest,
 * which is the failure this indirection avoids.
 *
 * @returns Deploy-time options wired from environment params.
 */
export function envDeployOptions(): DeployTimeOptions {
  return {
    region: params.location,
  };
}
