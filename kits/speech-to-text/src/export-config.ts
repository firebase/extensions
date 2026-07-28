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

import type { Expression } from "firebase-functions/params";

/**
 * Public configuration for the speech-to-text handler.
 *
 * `bucket` and `languageCode` are required; everything else has a sensible
 * default.
 */
export interface SpeechToTextConfig {
  /** Cloud Storage bucket the trigger listens to (and writes output into). */
  bucket: string;
  /** BCP-47 transcription language code, e.g. `en-US`. */
  languageCode: string;

  /** Speech-to-Text model. Defaults to `default`. */
  model?: string;
  /** Storage path prefix for transcribed output. Defaults to bucket root. */
  outputStoragePath?: string;
  /** Firestore collection for transcript docs. When unset, Firestore is
   *  skipped entirely (Storage-only output). */
  collectionPath?: string;
  /** Whether Speech-to-Text should add automatic punctuation. Defaults to
   *  `true`. */
  enableAutomaticPunctuation?: boolean;
  /** Function region. Defaults to `us-central1`. */
  location?: string;
  /** Function timeout in seconds. Defaults to `540` (the v2 event-function
   *  ceiling) so long audio does not time out mid-transcription. */
  timeoutSeconds?: number;
  /** Function memory. Defaults to `"1GiB"` to match the legacy 1024 MB. */
  memory?: SpeechToTextMemory;
}

/** Memory options accepted by the v2 function runtime. */
export type SpeechToTextMemory =
  | "128MiB"
  | "256MiB"
  | "512MiB"
  | "1GiB"
  | "2GiB"
  | "4GiB"
  | "8GiB"
  | "16GiB"
  | "32GiB";

/** {@link SpeechToTextConfig} with all defaults applied. */
export interface ResolvedSpeechToTextConfig {
  bucket: string;
  languageCode: string;
  model: string;
  outputStoragePath?: string;
  collectionPath?: string;
  enableAutomaticPunctuation: boolean;
  location: string;
  timeoutSeconds: number;
  memory: SpeechToTextMemory;
}

/**
 * Deploy-time function options that must be present in the deploy manifest, so
 * each may be a literal or a Firebase param {@link Expression}.
 *
 * These shape the trigger (the watched bucket) and the function region, and are
 * read by the Firebase CLI during the deploy discovery pass. They must never be
 * resolved with `.value()` at the module scope; pass the param objects through
 * so the SDK emits CEL expressions the CLI resolves after loading `.env` /
 * prompting. Freezing the `bucket` in particular would bind the trigger to the
 * default (empty) bucket, so the deployed function would watch the wrong bucket.
 *
 * @see https://firebase.google.com/docs/functions/config-env
 */
export interface DeployTimeOptions {
  /** Cloud Storage bucket the `onObjectFinalized` trigger listens to. */
  bucket: string | Expression<string>;
  /** Region for the function. */
  region: string | Expression<string>;
  /** Function timeout in seconds. */
  timeoutSeconds: number;
  /** Function memory. */
  memory: SpeechToTextMemory;
}

/** Coerce an empty string to `undefined`. */
function optional(value: string | undefined): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

/**
 * Applies defaults to a {@link SpeechToTextConfig}.
 *
 * @param config - The user-supplied configuration.
 * @returns The configuration with every field populated.
 */
export function resolveConfig(
  config: SpeechToTextConfig
): ResolvedSpeechToTextConfig {
  return {
    bucket: config.bucket,
    languageCode: config.languageCode,
    model: config.model ?? "default",
    outputStoragePath: optional(config.outputStoragePath),
    collectionPath: optional(config.collectionPath),
    enableAutomaticPunctuation: config.enableAutomaticPunctuation ?? true,
    location: config.location ?? "us-central1",
    timeoutSeconds: config.timeoutSeconds ?? 540,
    memory: config.memory ?? "1GiB",
  };
}
