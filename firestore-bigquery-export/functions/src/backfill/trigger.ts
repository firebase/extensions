import {
  FirestoreBackfillOptions,
  firestoreBackfillTrigger,
} from "@invertase/firebase-extension-utilities";
import config from "../config";
import { eventTracker } from "../event_tracker";

const { queueName, metadataDocumentPath, doBackfill, collectionPath } =
  config.backfillOptions;

const backfillOptions: FirestoreBackfillOptions = {
  queueName,
  collectionName: collectionPath,
  metadataDocumentPath,
  setupFn: async () => {
    await eventTracker.initialize();
  },
  shouldDoBackfill: async () => {
    return collectionPath && doBackfill;
  },
  extensionInstanceId: config.instanceId,
  batchSize: config.backfillOptions.batchSize,
};

export const backfillTrigger = firestoreBackfillTrigger(backfillOptions);
