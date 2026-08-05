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
 * Clone-and-deploy entry point. Reads deploy-time params from the environment
 * and registers the HTTPS `serve` function.
 *
 * This module reads the environment at load time, so it only runs cleanly inside
 * the Firebase toolchain (deploy discovery, runtime, or the emulator). Library
 * consumers should import from `./lib` instead and own trigger registration with
 * the side-effect-free handlers and config helpers.
 */

import { Storage } from "@google-cloud/storage";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import type { Role } from "firebase-functions/v2";
import { requiresRole } from "firebase-functions/v2";
import type { BundleSpec } from "./build-bundle";
import { configFromEnv, envDeployOptions } from "./config";
import { resolveConfig } from "./export-config";
import { type HandlerContext, handleServe } from "./handlers";

export * from "./lib";

const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/datastore.user",
  "roles/storage.objectAdmin",
  // Gen2 event triggers need Eventarc receive on the function SA.
  "roles/eventarc.eventReceiver",
];

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

const deploy = envDeployOptions();

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Resolve the runtime config once, on first use, never at module load. On the
// params path this is where `.value()` is read — safe at runtime, fatal at
// deploy discovery. Deploy-time options pass the region param Expression so the
// CLI resolves it after loading `.env` / prompting.
let ctx: HandlerContext | null = null;

function getContext(): HandlerContext {
  if (!ctx) {
    const resolved = resolveConfig(configFromEnv());
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

    ctx = {
      db,
      config: resolved,
      getSpec,
      bucket: bucket as HandlerContext["bucket"],
      logger,
    };
  }
  return ctx;
}

export const serve = onRequest({ region: deploy.region }, (req, res) =>
  handleServe(req, res, getContext())
);
