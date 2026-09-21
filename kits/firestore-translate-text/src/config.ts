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

import {
  defineSecret,
  defineString,
  type Expression,
  expr,
  projectID,
  select,
} from "firebase-functions/params";
import type { TranslateConfig } from "./export-config";

export const googleAiApiKey = defineSecret("GOOGLE_AI_API_KEY", {
  label: "Google AI API Key",
  description:
    'If you selected "AI Translations Using Gemini" and "Google AI" as the provider, provide your Google AI API key here. You can create an API key at: https://ai.google.dev/gemini-api/docs/api-key. This is not required if you use Vertex AI as the provider.',
});
type ConfigExpression<T extends string | number | boolean> = Expression<T>;

export interface ConfigExpressions {
  document: ConfigExpression<string>;
}

const TRANSLATION_PROVIDER_OPTIONS = [
  "translate",
  "gemini-googleai",
  "gemini-vertexai",
] as const;
const GEMINI_MODEL_OPTIONS = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

const params = {
  collectionPath: defineString("COLLECTION_PATH", {
    label: "Collection path",
    description:
      "What is the path to the collection that contains the strings that you want to translate?",

    default: "translations",
    input: {
      text: {
        example: "translations",

        validationRegex: /^[^\/]+(\/[^\/]+\/[^\/]+)*$/,
        validationErrorMessage: "Must be a valid Cloud Firestore Collection",
      },
    },
  }),
  inputFieldName: defineString("INPUT_FIELD_NAME", {
    label: "Input field name",
    description:
      "What is the name of the field that contains the string that you want to translate?",
    default: "input",
    // `required: true` in the extension, which refuses an empty answer.
    input: { text: { example: "input", nonEmpty: true } },
  }),
  outputFieldName: defineString("OUTPUT_FIELD_NAME", {
    label: "Translations output field name",
    description:
      "What is the name of the field where you want to store your translations?",
    default: "translated",
    // `required: true` in the extension, which refuses an empty answer.
    input: { text: { example: "translated", nonEmpty: true } },
  }),
  languages: defineString("LANGUAGES", {
    label: "Target languages for translations, as a comma-separated list",
    description:
      "Into which target languages do you want to translate new strings? The languages are identified using ISO-639-1 codes in a comma-separated list, for example: en,es,de,fr. For these codes, visit the [supported languages list](https://cloud.google.com/translate/docs/languages).",

    default: "en,es,de,fr",
    input: {
      text: {
        example: "en,es,de,fr",

        validationRegex: /^[a-zA-Z,-]*[a-zA-Z-]{2,}$/,
        validationErrorMessage:
          "Languages must be a comma-separated list of ISO-639-1 language codes.",
      },
    },
  }),
  languagesFieldName: defineString("LANGUAGES_FIELD_NAME", {
    label: "Languages field name",
    description:
      "What is the name of the field that contains the languages that you want to translate into? This field is optional. If you don't specify it, the extension will use the languages specified in the LANGUAGES parameter.",

    default: "languages",
    input: { text: { example: "languages" } },
  }),
  provider: defineString("TRANSLATION_PROVIDER", {
    label: "Translation Provider",
    description:
      'Choose the translation provider to use for this extension. "Cloud Translation API" uses the standard Google Cloud Translation service (fast, cost-effective). "Gemini (Google AI)" leverages Google\'s Gemini models via Google AI Studio for more accurate and context-aware translations (requires Gemini API access and API key). "Gemini (Vertex AI)" uses Gemini models through Vertex AI in your Google Cloud project (requires Vertex AI access).',

    input: select({
      "Cloud Translation API (standard, fast, cost-effective)": "translate",
      "Gemini (Google AI) (more context-aware, requires Gemini API key)":
        "gemini-googleai",
      "Gemini (Vertex AI) (more context-aware, requires Vertex AI access)":
        "gemini-vertexai",
    }),
  }),
  geminiModel: defineString("GEMINI_MODEL", {
    label: "Gemini Model",
    description:
      'Choose the Gemini model to use for translations. Consider model pricing, performance, and availability in your selected provider. This is only required if you select "AI Translations Using Gemini" as your translation model. By default, the extension uses Gemini 2.5 Flash for a balance of speed and cost.',

    default: "gemini-2.5-flash",
    input: select({
      "Gemini 2.5 Pro (highest quality, expensive, large max output size)":
        "gemini-2.5-pro",
      "Gemini 2.5 Flash (cost-effective, high quality, large max output size)":
        "gemini-2.5-flash",
      "Gemini 2.5 Flash Lite (cheap, good quality, large max output size)":
        "gemini-2.5-flash-lite",
    }),
  }),
};

export const CONFIG_EXPRESSIONS: ConfigExpressions = {
  document: expr`${params.collectionPath}/{messageId}`,
};

function optional(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

export function configFromEnv(): TranslateConfig {
  return {
    collectionPath: params.collectionPath.value(),
    inputFieldName: params.inputFieldName.value(),
    outputFieldName: params.outputFieldName.value(),
    languages: params.languages.value(),
    languagesFieldName: optional(params.languagesFieldName.value()),
    provider: optional(params.provider.value()) as TranslateConfig["provider"],
    geminiModel: optional(params.geminiModel.value()),
    region: process.env.FUNCTION_REGION,
    projectId: projectID.value(),
  };
}

// Params the published extension marks `required: true`. A value the user never
// supplied is absent from process.env; one they deliberately blanked is present
// and empty. Only the second is a misconfiguration, so the guard below reads
// process.env rather than `.value()`, which reports both as "".
const REQUIRED_PARAMS = [
  "LANGUAGES",
  "COLLECTION_PATH",
  "INPUT_FIELD_NAME",
  "OUTPUT_FIELD_NAME",
  "TRANSLATION_PROVIDER",
] as const;

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
