import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/firestore";
import { onCall, onRequest } from "firebase-functions/https";
import { onTaskDispatched } from "firebase-functions/tasks";
import { geminiApiKey, openAiApiKey } from "./config";
import * as events from "./events";
import {
  type ResolvedVectorSearchConfig,
  resolveVectorSearchConfig,
  type VectorSearchConfig,
} from "./export-config";
import {
  type HandlerContext,
  handleBackfillTask,
  handleBackfillTrigger,
  handleEmbedOnWrite,
  handleInit,
  handleQueryCall,
  handleQueryOnWrite,
  handleUpdateTask,
  handleUpdateTrigger,
  type VectorTaskData,
} from "./handlers";
import * as logs from "./logs";

export const metadata = {
  roles: [
    "datastore.user",
    "aiplatform.user",
    "storage.objectAdmin",
    "datastore.indexAdmin",
  ],
  apis: ["aiplatform.googleapis.com", "storage-component.googleapis.com"],
  lifecycle: {
    init: "initVectorSearch",
  },
  functionNames: [
    "updateTrigger",
    "updateTask",
    "backfillTrigger",
    "backfillTask",
    "embedOnWrite",
    "queryOnWrite",
    "queryCallable",
    "initVectorSearch",
  ],
} as const;

export function defineFirestoreVectorSearch(config: VectorSearchConfig) {
  const resolved = resolveVectorSearchConfig(config);
  return buildVectorSearchFunctions(
    {
      region: resolved.region,
      collectionDocument: `${resolved.collectionPath}/{docId}`,
      queryDocument: `${resolved.queryCollectionPath}/{queryId}`,
    },
    () => resolved
  );
}

export function buildVectorSearchFunctions(
  deploy: {
    region: string;
    collectionDocument: string;
    queryDocument: string;
  },
  resolveConfig: () => ResolvedVectorSearchConfig
) {
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }

  events.setupEventChannel();

  let config: ResolvedVectorSearchConfig | undefined;
  const getConfig = (): ResolvedVectorSearchConfig => {
    config ??= resolveConfig();
    logs.init(config);
    return config;
  };

  const getContext = (): HandlerContext => ({
    firestore: admin.firestore(),
    config: getConfig(),
  });

  return {
    updateTrigger: onTaskDispatched(
      { region: deploy.region, memory: "512MiB", timeoutSeconds: 540 },
      (request) => handleUpdateTrigger(request, getContext())
    ),
    updateTask: onTaskDispatched<VectorTaskData>(
      {
        region: deploy.region,
        memory: "1GiB",
        timeoutSeconds: 540,
        retryConfig: { maxAttempts: 50 },
      },
      (request) => handleUpdateTask(request, getContext())
    ),
    backfillTrigger: onTaskDispatched(
      { region: deploy.region, memory: "512MiB", timeoutSeconds: 540 },
      (request) => handleBackfillTrigger(request, getContext())
    ),
    backfillTask: onTaskDispatched<VectorTaskData>(
      {
        region: deploy.region,
        memory: "1GiB",
        timeoutSeconds: 540,
        retryConfig: { maxAttempts: 50 },
      },
      (request) => handleBackfillTask(request, getContext())
    ),
    embedOnWrite: onDocumentWritten(
      {
        document: deploy.collectionDocument,
        region: deploy.region,
        memory: "512MiB",
        timeoutSeconds: 540,
        secrets: [geminiApiKey, openAiApiKey],
      },
      (event) => handleEmbedOnWrite(event, getContext())
    ),
    queryOnWrite: onDocumentWritten(
      {
        document: deploy.queryDocument,
        region: deploy.region,
        memory: "512MiB",
        timeoutSeconds: 540,
        secrets: [geminiApiKey, openAiApiKey],
      },
      (event) => handleQueryOnWrite(event, getContext())
    ),
    queryCallable: onCall(
      {
        region: deploy.region,
        memory: "512MiB",
        secrets: [geminiApiKey, openAiApiKey],
      },
      (request) => handleQueryCall(request, getContext())
    ),
    initVectorSearch: onRequest(
      {
        region: deploy.region,
        memory: "512MiB",
        timeoutSeconds: 540,
        secrets: [geminiApiKey, openAiApiKey],
      },
      async (_req, res) => {
        await handleInit(getContext());
        res.status(204).send();
      }
    ),
  };
}
