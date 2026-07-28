import { getApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Role } from "firebase-functions/v2";
import { requiresAPI, requiresRole } from "firebase-functions/v2";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { CONFIG_EXPRESSIONS, configFromEnv, googleAiApiKey } from "./config";
import * as events from "./events";
import {
  type ResolvedTranslateConfig,
  resolveTranslateConfig,
} from "./export-config";
import { type HandlerContext, handleDocumentWrite } from "./handlers";
import * as logs from "./logs";

export * from "./lib";

const REQUIRED_ROLES: ReadonlyArray<Role> = ["roles/datastore.user"];
const REQUIRED_APIS = [
  {
    api: "translate.googleapis.com",
    reason:
      "To use Google Translate to translate strings into the specified target languages.",
  },
] as const;

for (const role of REQUIRED_ROLES) {
  requiresRole(role);
}

for (const { api, reason } of REQUIRED_APIS) {
  requiresAPI(api, reason);
}

let resolvedConfig: ResolvedTranslateConfig | undefined;
let context: HandlerContext | undefined;

function getConfig(): ResolvedTranslateConfig {
  if (resolvedConfig) {
    return resolvedConfig;
  }

  resolvedConfig = resolveTranslateConfig(configFromEnv());
  logs.init(resolvedConfig);
  return resolvedConfig;
}

function ensureDefaultApp(): void {
  try {
    getApp();
  } catch {
    initializeApp();
  }
}

function getContext(): HandlerContext {
  if (context) {
    return context;
  }

  ensureDefaultApp();

  events.setupEventChannel();

  const config = getConfig();
  context = {
    firestore: getFirestore(),
    config,
    googleAiApiKey: config.useGenkit ? googleAiApiKey.value() : undefined,
  };

  return context;
}

export const fstranslate = onDocumentWritten(
  {
    region: CONFIG_EXPRESSIONS.region,
    document: CONFIG_EXPRESSIONS.document,
    secrets: [googleAiApiKey],
  },
  (event) => handleDocumentWrite(event, getContext())
);
