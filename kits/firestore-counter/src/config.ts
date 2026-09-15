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
import { defineString, expr } from "firebase-functions/params";
import type { CounterConfig } from "./export-config";

type ConfigExpression<T extends string | number | boolean> = Expression<T>;

export interface ConfigExpressions {
  internalStatePath: ConfigExpression<string>;
  schedule: ConfigExpression<string>;
}

const params = {
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

export function configFromEnv(): CounterConfig {
  return {
    internalStatePath: params.internalStatePath.value(),
    scheduleFrequencyMinutes: Number(params.scheduleFrequencyMinutes.value()),
  };
}

// Params the published extension marks `required: true`. A value the user never
// supplied is absent from process.env; one they deliberately blanked is present
// and empty. Only the second is a misconfiguration, so the guard below reads
// process.env rather than `.value()`, which reports both as "".
const REQUIRED_PARAMS = ["INTERNAL_STATE_PATH", "SCHEDULE_FREQUENCY"] as const;

/**
 * Rejects required params that were explicitly set to an empty value.
 *
 * `.env` values bypass the CLI's prompt-time validation and take precedence
 * over a param's declared default, so an empty entry otherwise reaches the
 * handlers silently. Called at module scope so deploy-time discovery fails
 * before the function ships, rather than on the first event.
 */
export function assertRequiredParams(
  names: ReadonlyArray<string> = REQUIRED_PARAMS
): void {
  const blank = names.filter((name) => {
    const raw = process.env[name];
    return raw !== undefined && raw.trim() === "";
  });

  if (blank.length > 0) {
    throw new Error(
      `Required parameters are set to an empty value: ${blank.join(", ")}. ` +
        "Set them in your .env file, or remove the entries to use their defaults."
    );
  }
}
