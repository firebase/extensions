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

export type TranslationProvider =
  | "translate"
  | "gemini-googleai"
  | "gemini-vertexai";
export type GeminiProvider = "googleai" | "vertexai";

export interface TranslateConfig {
  collectionPath: string;
  inputFieldName: string;
  outputFieldName: string;
  languages: ReadonlyArray<string> | string;
  languagesFieldName?: string;
  provider?: TranslationProvider;
  geminiModel?: string;
  googleAiApiKey?: string;
  region?: string;
  projectId?: string;
}

export interface ResolvedTranslateConfig {
  collectionPath: string;
  inputFieldName: string;
  outputFieldName: string;
  languages: ReadonlyArray<string>;
  languagesFieldName?: string;
  provider: TranslationProvider;
  useGenkit: boolean;
  geminiProvider: GeminiProvider;
  geminiModel: string;
  googleAiApiKey?: string;
  region?: string;
  projectId?: string;
}

const DEFAULT_PROVIDER: TranslationProvider = "translate";
const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

function toUniqueArray(
  languages: ReadonlyArray<string> | string
): ReadonlyArray<string> {
  const values =
    typeof languages === "string" ? languages.split(",") : languages;
  return Array.from(new Set(values));
}

function geminiProvider(provider: TranslationProvider): GeminiProvider {
  return provider === "gemini-googleai" ? "googleai" : "vertexai";
}

export function resolveTranslateConfig(
  config: TranslateConfig
): ResolvedTranslateConfig {
  const provider = config.provider ?? DEFAULT_PROVIDER;
  return {
    collectionPath: config.collectionPath,
    inputFieldName: config.inputFieldName,
    outputFieldName: config.outputFieldName,
    languages: toUniqueArray(config.languages),
    languagesFieldName: config.languagesFieldName,
    provider,
    useGenkit: provider.startsWith("gemini"),
    geminiProvider: geminiProvider(provider),
    geminiModel: config.geminiModel ?? DEFAULT_GEMINI_MODEL,
    googleAiApiKey: config.googleAiApiKey,
    region: config.region ?? process.env.FUNCTION_REGION,
    projectId: config.projectId,
  };
}
