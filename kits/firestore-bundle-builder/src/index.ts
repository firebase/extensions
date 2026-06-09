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
 * Clone-and-deploy entry point. Reads deploy-time params from the environment,
 * builds a {@link BundleBuilderConfig}, and registers the function via the
 * factory.
 *
 * This module reads the environment at load time, so it only runs cleanly inside
 * the Firebase toolchain (deploy discovery, runtime, or the emulator). Library
 * consumers should import from `./lib` instead and call the factory with their
 * own typed config.
 */

import { configFromEnv } from "./config";
import { defineFirestoreBundleBuilder } from "./factory";

// Re-export the full library surface for consumers of this package.
export * from "./lib";

export const { serve } = defineFirestoreBundleBuilder(configFromEnv());
