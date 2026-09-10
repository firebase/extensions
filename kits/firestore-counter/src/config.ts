/**
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
import { defineString, expr, select } from "firebase-functions/params";
import type { CounterConfig } from "./export-config";
import { firestoreLocationToFunctionRegion } from "./region";

type ConfigExpression<T extends string | number | boolean> = Expression<T>;

export interface ConfigExpressions {
  internalStatePath: ConfigExpression<string>;
  schedule: ConfigExpression<string>;
}

const params = {
  databaseRegion: defineString("DATABASE_REGION", {
    label: "Firestore Instance Location",
    description:
      "Where is the Firestore database located? You can check your current database location at [https://console.cloud.google.com/firestore/databases](https://console.cloud.google.com/firestore/databases). The functions in this kit deploy to the Cloud Run region closest to this location.",

    input: select({
      "Multi-region (Europe - Belgium and Netherlands)": "eur3",
      "Multi-region (United States)": "nam5",
      "Multi-region (Iowa, North Virginia, and Oklahoma)": "nam7",
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
  internalStatePath: defineString("INTERNAL_STATE_PATH", {
    label: "Document path for internal state",
    description:
      "What is the path to the document where the extension can keep its internal state?",

    default: "_firebase_ext_/sharded_counter",
    input: {
      text: {
        example: "_firebase_ext_/sharded_counter",

        validationRegex: /^[^\/]+\/[^\/]+(\/[^\/]+\/[^\/]+)*$/,
        validationErrorMessage:
          "Enter a document path, not a collection path. The path must have an even number of segments, for example, `my_collection/doc` or `my_collection/doc/subcollection/doc`, but not `my_collection`.",
      },
    },
  }),
  scheduleFrequencyMinutes: defineString("SCHEDULE_FREQUENCY", {
    label: "Frequency for controllerCore function to be run",
    description:
      "In minutes, how often should the function to aggregate shards be run?",

    default: "1",
    input: {
      text: {
        validationRegex: /^[1-9][0-9]*$/,
        validationErrorMessage:
          "The number of minutes must be an integer value greater than zero.",
      },
    },
  }),
};

export const CONFIG_EXPRESSIONS: ConfigExpressions = {
  internalStatePath: params.internalStatePath,
  schedule: expr`every ${params.scheduleFrequencyMinutes} minutes`,
};

/**
 * Cloud Run region for this kit's functions, derived from the Firestore
 * database location.
 *
 * The multi-region to Cloud Run region lookup cannot be expressed in CEL, and
 * the region option does not accept a param expression, so the value is read
 * from `process.env` (populated from `.env` during CLI discovery) rather than
 * from the param. `undefined` means the functions declare no region and the
 * CLI falls back to its own default.
 */
export function envFunctionRegion(): string | undefined {
  return firestoreLocationToFunctionRegion(process.env.DATABASE_REGION);
}

export function configFromEnv(): CounterConfig {
  return {
    internalStatePath: params.internalStatePath.value(),
    scheduleFrequencyMinutes: Number(params.scheduleFrequencyMinutes.value()),
  };
}
