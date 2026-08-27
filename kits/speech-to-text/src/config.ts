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

/**
 * Deploy-time parameters. Set these via a `.env` / `.env.<project>` file or the
 * interactive prompts shown by `firebase deploy`. The env var names match the
 * original extension so a migrating customer's `.env` is a lift-and-shift.
 *
 * @see https://firebase.google.com/docs/functions/config-env
 */
const params = {
  bucket: defineString("EXTENSION_BUCKET", {
    label: "Cloud Storage bucket for input and output",
    description:
      "The Cloud Storage bucket that the extension should be listening to. Files uploaded to this bucket will be transcribed by the extension. If cloud storage output is enabled, transcriptions will be written to this bucket.",

    default: storageBucket,
    input: BUCKET_PICKER,
  }),
  languageCode: defineString("LANGUAGE_CODE", {
    label: "BCP-47 code of the transcription language",
    description:
      "The BCP-47 code of the transcription language, as shown in the [Language support documentation](https://cloud.google.com/speech-to-text/docs/languages)",

    input: {
      text: {
        example: "e.g. en-US",

        validationRegex: /^([a-zA-Z-])*[A-Z][A-Z]$/,
        validationErrorMessage:
          "Must be a valid code from https://cloud.google.com/speech-to-text/docs/languages",
      },
    },
  }),
  model: defineString("MODEL", {
    label: "Language model used for transcription",
    description:
      "Which kind of use-case should the speech-to-text transcription algorithm be honed for? For details, see [the model field in the documentation](https://cloud.google.com/speech-to-text/docs/reference/rest/v1/RecognitionConfig)\nIf you're not sure, just use the default.",
    default: "default",
    input: { text: { example: "default" } },
  }),
  outputStoragePath: defineString("OUTPUT_STORAGE_PATH", {
    label: "Storage path for transcriptions",
    description:
      "The storage path in which to output transcriptions. If this is not set, the extension will output to the root of the bucket.",
    default: "",
    input: { text: { example: "transcriptions" } },
  }),
  collectionPath: defineString("COLLECTION_PATH", {
    label: "Firestore collection for storing transcribed audio",
    description:
      "The firestore collection in which to output transcriptions. If this is not set, the extension will not output the data to Firestore.",

    default: "",
    input: {
      text: {
        example: "transcriptions",

        // Extension regex, with an empty branch added: the param is optional.
        validationRegex: /^(?:[^\/]+(\/[^\/]+\/[^\/]+)*|)$/,
        validationErrorMessage: "Must be a valid Cloud Firestore Collection",
      },
    },
  }),
  enableAutomaticPunctuation: defineBoolean("ENABLE_AUTOMATIC_PUNCTUATION", {
    label: "Enable automatic punctuation",
    description:
      "Should the transcription algorithm attempt to add punctuation to the transcription? For details, see [the documentation](https://cloud.google.com/speech-to-text/docs/automatic-punctuation)",

    default: true,
    input: select({ Enabled: true, Disabled: false }),
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
  };
}

/**
 * Builds the {@link DeployTimeOptions} for the params-driven entry point.
 *
 * The bucket stays a CEL parameter expression so the Firebase CLI resolves it
 * after loading `.env`.
 *
 * `timeoutSeconds` and `memory` are not param-driven, so they pass through as
 * the resolved literal defaults.
 *
 * @returns Deploy-time options wired from environment params.
 */
export function envDeployOptions(): DeployTimeOptions {
  // Resolved with placeholder required fields purely to read the literal
  // timeout/memory defaults; bucket below comes straight from the params.
  const defaults = resolveConfig({ bucket: "", languageCode: "" });

  return {
    bucket: params.bucket,
    timeoutSeconds: defaults.timeoutSeconds,
    memory: defaults.memory,
  };
}
