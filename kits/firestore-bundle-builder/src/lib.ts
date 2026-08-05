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
 * Public library surface, in tiers:
 *
 * - {@link defineFirestoreBundleBuilder} — the factory most consumers use.
 * - {@link handleServe} — the raw handler, for consumers who want to own
 *   trigger registration.
 * - {@link build} / {@link buildQuery} — the framework-agnostic bundle assembly.
 *
 * Importing this module has no side effects (it reads no environment), so it is
 * safe to import anywhere. The clone-and-deploy entry point (`./index`) is the
 * one that reads env params and registers functions.
 */

// Bundle assembly (framework-agnostic core)
export {
  type BundleSpec,
  build,
  buildQuery,
  type ParamSpec,
  type ParamsSpec,
  type ParamValues,
  parameterize,
  parameterizePath,
  type QueryConditionSpec,
  type QuerySpec,
} from "./build-bundle";
// Config types and helpers
export {
  type BundleBuilderConfig,
  type DeployTimeOptions,
  type ResolvedBundleBuilderConfig,
  resolveConfig,
} from "./export-config";
// Tier 3 — factory
export {
  buildBundleFunctions,
  defineFirestoreBundleBuilder,
} from "./factory";
// Handler
export {
  type CacheBucket,
  type CacheFile,
  type HandlerContext,
  type HandlerLogger,
  handleServe,
  type ServeResponse,
} from "./handlers";
