import {
  defineSecret,
  defineString,
  type Expression,
  expr,
  projectID,
  select,
} from "firebase-functions/params";
import type { TranslateConfig } from "./export-config";

export const googleAiApiKey = defineSecret("GOOGLE_AI_API_KEY");
type ConfigExpression<T extends string | number | boolean> = Expression<T>;

export interface ConfigExpressions {
  region: ConfigExpression<string>;
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
  collectionPath: defineString("COLLECTION_PATH", { default: "translations" }),
  inputFieldName: defineString("INPUT_FIELD_NAME", { default: "input" }),
  outputFieldName: defineString("OUTPUT_FIELD_NAME", { default: "translated" }),
  languages: defineString("LANGUAGES", { default: "en,es,de,fr" }),
  languagesFieldName: defineString("LANGUAGES_FIELD_NAME", {
    default: "languages",
  }),
  provider: defineString("TRANSLATION_PROVIDER", {
    input: select([...TRANSLATION_PROVIDER_OPTIONS]),
  }),
  geminiModel: defineString("GEMINI_MODEL", {
    default: "gemini-2.5-flash",
    input: select([...GEMINI_MODEL_OPTIONS]),
  }),
  region: defineString("LOCATION", { default: "us-central1" }),
};

export const CONFIG_EXPRESSIONS: ConfigExpressions = {
  region: params.region,
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
    region: params.region.value(),
    projectId: projectID.value(),
  };
}
