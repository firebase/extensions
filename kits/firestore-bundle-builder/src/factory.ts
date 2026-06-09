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

import { Storage } from "@google-cloud/storage";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { type HttpsFunction, onRequest } from "firebase-functions/https";
import type { BundleSpec } from "./build-bundle";
import { type BundleBuilderConfig, resolveConfig } from "./export-config";
import { type HandlerContext, handleServe } from "./handlers";

/**
 * Builds the HTTPS Cloud Function that serves Firestore data bundles.
 *
 * Call this at the top level of your functions entry point and re-export the
 * returned `serve` function so the Firebase CLI can discover it.
 *
 * @param config - The bundle builder configuration.
 * @returns The wired `serve` HTTPS function.
 *
 * @example
 * ```ts
 * export const { serve } = defineFirestoreBundleBuilder({
 *   bundleSpecCollection: "bundles",
 *   bundleStorageBucket: "my-project.appspot.com",
 *   storagePrefix: "bundles",
 * });
 * ```
 */
export function defineFirestoreBundleBuilder(config: BundleBuilderConfig): {
  serve: HttpsFunction;
} {
  const resolved = resolveConfig(config);

  if (admin.apps.length === 0) {
    admin.initializeApp();
  }

  const db = admin.firestore();

  // An empty bucket name disables the Storage cache (legacy behaviour).
  const bucket = resolved.bundleStorageBucket
    ? new Storage().bucket(resolved.bundleStorageBucket)
    : null;

  const getSpec = async (bundleId: string): Promise<BundleSpec | null> => {
    const snap = await db
      .collection(resolved.bundleSpecCollection)
      .doc(bundleId)
      .get();
    return snap.exists ? (snap.data() as BundleSpec) : null;
  };

  const ctx: HandlerContext = {
    db,
    config: resolved,
    getSpec,
    bucket: bucket as HandlerContext["bucket"],
    logger,
  };

  const serve = onRequest(
    {
      region: resolved.region,
      serviceAccount: resolved.serviceAccount,
    },
    (req, res) => handleServe(req, res, ctx)
  );

  return { serve };
}
