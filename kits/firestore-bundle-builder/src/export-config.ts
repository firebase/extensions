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
 * Public configuration for {@link defineFirestoreBundleBuilder}.
 *
 * This is a plain object, so consumers can wire up several independent bundle
 * builders in one functions codebase. `bundleStorageBucket` and `storagePrefix`
 * are only consulted when a bundle spec opts into `fileCache`.
 */
export interface BundleBuilderConfig {
  /** Firestore collection holding the bundle specification documents. */
  bundleSpecCollection: string;
  /**
   * Cloud Storage bucket used to cache built bundle files. When a bundle spec
   * sets `fileCache`, the built bundle is read from / written to this bucket. An
   * empty string disables the Storage cache.
   */
  bundleStorageBucket?: string;
  /** Object-name prefix for cached bundle files in Cloud Storage. */
  storagePrefix?: string;
  /** Region for the HTTPS function. Defaults to `us-central1`. */
  region?: string;
  /** Runtime service account email. */
  serviceAccount?: string;
}

/** {@link BundleBuilderConfig} with all defaults applied. */
export interface ResolvedBundleBuilderConfig {
  bundleSpecCollection: string;
  bundleStorageBucket: string;
  storagePrefix: string;
  region: string;
  serviceAccount?: string;
}

/**
 * Applies defaults to a {@link BundleBuilderConfig}.
 *
 * Defaults mirror the legacy extension: `bundles` for both the spec collection
 * and the storage prefix, and `bundle-builder-files` for the storage bucket.
 *
 * @param config - The user-supplied configuration.
 * @returns The configuration with every field populated.
 */
export function resolveConfig(
  config: BundleBuilderConfig
): ResolvedBundleBuilderConfig {
  return {
    bundleSpecCollection: config.bundleSpecCollection || "bundles",
    bundleStorageBucket: config.bundleStorageBucket ?? "bundle-builder-files",
    storagePrefix: config.storagePrefix ?? "bundles",
    region: config.region ?? "us-central1",
    serviceAccount: config.serviceAccount,
  };
}
