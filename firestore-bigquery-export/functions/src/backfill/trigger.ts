import {
  FirestoreBackfillOptions,
  firestoreProcessBackfillTrigger,
} from "@invertase/firebase-extension-utilities";
import config from "../config";

const { queueName, metadataDocumentPath, doBackfill, collectionPath } =
  config.backfillOptions;

const backfillOptions: FirestoreBackfillOptions = {
  queueName,
  collectionName: collectionPath,
  metadataDocumentPath,
  shouldDoBackfill: async () => collectionPath && doBackfill,
  extensionInstanceId: config.instanceId,
};

export const backfillTrigger = firestoreProcessBackfillTrigger(backfillOptions);
