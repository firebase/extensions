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
import { bucketLocationToFunctionRegion } from "./region";

/**
 * Deploy-time parameters. Set these via a `.env` / `.env.<project>` file or the
 * interactive prompts shown by `firebase deploy`. The env var names match the
 * original extension so a migrating customer's `.env` is a lift-and-shift.
 *
 * @see https://firebase.google.com/docs/functions/config-env
 */
const params = {
  bucketRegion: defineString("BUCKET_REGION", {
    label: "Cloud Storage Bucket Location",
    description:
      "Where is the Cloud Storage bucket located? You can check your bucket's location at [https://console.cloud.google.com/storage/browser](https://console.cloud.google.com/storage/browser). The function in this kit deploy to the Cloud Run region closest to this location.",

    input: select({
      "Multi-region (United States)": "us",
      "Multi-region (Europe)": "eu",
      "Multi-region (Asia)": "asia",
      "Iowa (us-central1)": "us-central1",
      "Oregon (us-west1)": "us-west1",
      "Los Angeles (us-west2)": "us-west2",
      "Salt Lake City (us-west3)": "us-west3",
      "Las Vegas (us-west4)": "us-west4",
      "South Carolina (us-east1)": "us-east1",
      "Northern Virginia (us-east4)": "us-east4",
      "Columbus (us-east5)": "us-east5",
      "Dallas (us-south1)": "us-south1",
      "Montreal (northamerica-northeast1)": "northamerica-northeast1",
      "Toronto (northamerica-northeast2)": "northamerica-northeast2",
      "Queretaro (northamerica-south1)": "northamerica-south1",
      "Sao Paulo (southamerica-east1)": "southamerica-east1",
      "Santiago (southamerica-west1)": "southamerica-west1",
      "Belgium (europe-west1)": "europe-west1",
      "London (europe-west2)": "europe-west2",
      "Frankfurt (europe-west3)": "europe-west3",
      "Netherlands (europe-west4)": "europe-west4",
      "Zurich (europe-west6)": "europe-west6",
      "Milan (europe-west8)": "europe-west8",
      "Paris (europe-west9)": "europe-west9",
      "Berlin (europe-west10)": "europe-west10",
      "Turin (europe-west12)": "europe-west12",
      "Madrid (europe-southwest1)": "europe-southwest1",
      "Finland (europe-north1)": "europe-north1",
      "Stockholm (europe-north2)": "europe-north2",
      "Warsaw (europe-central2)": "europe-central2",
      "Doha (me-central1)": "me-central1",
      "Dammam (me-central2)": "me-central2",
      "Tel Aviv (me-west1)": "me-west1",
      "Mumbai (asia-south1)": "asia-south1",
      "Delhi (asia-south2)": "asia-south2",
      "Singapore (asia-southeast1)": "asia-southeast1",
      "Jakarta (asia-southeast2)": "asia-southeast2",
      "Taiwan (asia-east1)": "asia-east1",
      "Hong Kong (asia-east2)": "asia-east2",
      "Tokyo (asia-northeast1)": "asia-northeast1",
      "Osaka (asia-northeast2)": "asia-northeast2",
      "Seoul (asia-northeast3)": "asia-northeast3",
      "Sydney (australia-southeast1)": "australia-southeast1",
      "Melbourne (australia-southeast2)": "australia-southeast2",
      "Johannesburg (africa-south1)": "africa-south1",
    }),
  }),
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

  // The multi-region to Cloud Run region lookup cannot be expressed in CEL, and
  // the region option does not accept a param expression, so the value is read
  // from `process.env` (populated from `.env` during CLI discovery).
  const region = bucketLocationToFunctionRegion(process.env.BUCKET_REGION);

  return {
    ...(region ? { region } : {}),
    bucket: params.bucket,
    timeoutSeconds: defaults.timeoutSeconds,
    memory: defaults.memory,
  };
}
