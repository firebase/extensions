import { logger } from "firebase-functions";
import type { ResolvedVectorSearchConfig } from "./export-config";

export function init(config: ResolvedVectorSearchConfig): void {
  logger.log("Initializing extension with configuration", {
    ...config,
    geminiApiKey: config.geminiApiKey ? "<omitted>" : undefined,
    openAiApiKey: config.openAiApiKey ? "<omitted>" : undefined,
  });
}

export function start(operation: string): void {
  logger.log(`Started firestore-vector-search ${operation}`);
}

export function complete(operation: string): void {
  logger.log(`Completed firestore-vector-search ${operation}`);
}

export function error(operation: string, err: unknown): void {
  logger.error(`Failed firestore-vector-search ${operation}`, err);
}
