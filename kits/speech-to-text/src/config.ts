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
import {
  BUCKET_PICKER,
  defineBoolean,
  defineString,
  select,
  storageBucket,
} from "firebase-functions/params";

import {
  type DeployTimeOptions,
  resolveConfig,
  type SpeechToTextConfig,
} from "./export-config";

const FUNCTION_REGION_OPTIONS = [
  "us-central1",
  "us-east1",
  "us-east4",
  "europe-west1",
  "europe-west2",
  "europe-west3",
  "asia-east2",
  "asia-northeast1",
] as const;

/**
 * Deploy-time parameters. Set these via a `.env` / `.env.<project>` file or the
 * interactive prompts shown by `firebase deploy`. The env var names match the
 * original extension so a migrating customer's `.env` is a lift-and-shift.
 *
 * @see https://firebase.google.com/docs/functions/config-env
 */
const params = {
  bucket: defineString("EXTENSION_BUCKET", {
    default: storageBucket,
    input: BUCKET_PICKER,
  }),
  languageCode: defineString("LANGUAGE_CODE"),
  model: defineString("MODEL", { default: "default" }),
  outputStoragePath: defineString("OUTPUT_STORAGE_PATH", { default: "" }),
  collectionPath: defineString("COLLECTION_PATH", { default: "" }),
  enableAutomaticPunctuation: defineBoolean("ENABLE_AUTOMATIC_PUNCTUATION", {
    default: true,
  }),
  location: defineString("LOCATION", {
    default: "us-central1",
    input: select([...FUNCTION_REGION_OPTIONS]),
  }),
};

/** Coerce an empty-string param value to `undefined`. */
function optional(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

/**
 * Resolves all deploy-time params into a {@link SpeechToTextConfig}.
 *
 * @returns The configuration assembled from environment params.
 */
export function configFromEnv(): SpeechToTextConfig {
  return {
    bucket: params.bucket.value(),
    languageCode: params.languageCode.value(),
    model: optional(params.model.value()),
    outputStoragePath: optional(params.outputStoragePath.value()),
    collectionPath: optional(params.collectionPath.value()),
    enableAutomaticPunctuation: params.enableAutomaticPunctuation.value(),
    location: params.location.value(),
  };
}

/**
 * Builds the {@link DeployTimeOptions} for the params-driven entry point.
 *
 * Unlike {@link configFromEnv}, this never calls `.value()` on the `bucket` and
 * `region` params: it passes the param objects through as CEL
 * {@link Expression}s so the trigger's bucket and the function region appear in
 * the deploy manifest as expressions the Firebase CLI resolves after loading
 * `.env` / prompting. Calling `.value()` here would freeze deploy-time defaults
 * into the manifest (e.g. an empty `bucket`, binding the trigger to the wrong
 * bucket), which is the failure this indirection avoids.
 *
 * `timeoutSeconds` and `memory` are not param-driven, so they pass through as
 * the resolved literal defaults.
 *
 * @returns Deploy-time options wired from environment params.
 */
export function envDeployOptions(): DeployTimeOptions {
  // Resolved with placeholder required fields purely to read the literal
  // timeout/memory defaults; bucket/region below come straight from the params.
  const defaults = resolveConfig({ bucket: "", languageCode: "" });

  return {
    bucket: params.bucket,
    region: params.location,
    timeoutSeconds: defaults.timeoutSeconds,
    memory: defaults.memory,
  };
}
