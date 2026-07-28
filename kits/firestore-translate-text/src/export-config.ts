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
  region: string;
  projectId?: string;
}

const DEFAULT_REGION = "us-central1";
const DEFAULT_PROVIDER: TranslationProvider = "translate";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

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
    region: config.region ?? DEFAULT_REGION,
    projectId: config.projectId,
  };
}
