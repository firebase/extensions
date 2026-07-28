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

import { getApps, initializeApp } from "firebase-admin/app";
import { onDocumentWritten } from "firebase-functions/firestore";
import type { Role } from "firebase-functions/v2";
import { requiresAPI, requiresRole } from "firebase-functions/v2";
import { apiKeySecret, configFromEnv, envDeployOptions } from "./config";
import type { ResolvedGenaiChatbotConfig } from "./export-config";
import { resolveConfig } from "./export-config";
import {
  createProcessor,
  type HandlerContext,
  handleDocumentWrite,
} from "./handlers";

// Re-export the full library surface for consumers of this package.
export * from "./lib";

const REQUIRED_ROLES: ReadonlyArray<Role> = [
  "roles/datastore.user",
  "roles/aiplatform.user",
  "roles/monitoring.metricWriter",
  "roles/cloudtrace.agent",
  "roles/logging.logWriter",
];
const REQUIRED_APIS = [
  {
    api: "aiplatform.googleapis.com",
    reason:
      "For access to the Vertex AI Gemini API if this provider is chosen.",
  },
] as const;

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

for (const { api, reason } of REQUIRED_APIS) {
  requiresAPI(api, reason);
}

// Deploy-time options (document path, region) are param expressions resolved by
// the CLI from `.env`; the runtime config resolver runs only on the first
// invocation, so its `.value()` reads are deferred past deploy discovery. The
// API key secret is bound by name at deploy time.
const deployOptions = envDeployOptions();
let resolvedConfig: ResolvedGenaiChatbotConfig | undefined;
let context: HandlerContext | undefined;

function getConfig(): ResolvedGenaiChatbotConfig {
  resolvedConfig ??= resolveConfig(configFromEnv());
  return resolvedConfig;
}

function getContext(): HandlerContext {
  if (context) {
    return context;
  }

  if (getApps().length === 0) {
    initializeApp();
  }

  context = { processor: createProcessor(getConfig()) };
  return context;
}

export const generateMessage = onDocumentWritten(
  {
    document: deployOptions.document,
    region: deployOptions.region,
    secrets: [apiKeySecret],
  },
  (event) => handleDocumentWrite(event, getContext())
);
