import {
  FirestoreBackfillOptions,
  taskThreadTaskHandler,
  firestoreProcessBackfillTrigger,
} from "@invertase/firebase-extension-utilities";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import config from "../config";
import { getFirestore } from "firebase-admin/firestore";
import { getExtensions } from "firebase-admin/extensions";
import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";
import { resolveWildcardIds } from "../util";
import { eventTracker } from "../event_tracker";

const { queueName, metadataDocumentPath, doBackfill, collectionPath } =
  config.backfillOptions;

const backfillOptions: FirestoreBackfillOptions = {
  queueName,
  collectionName: collectionPath,
  metadataDocumentPath,
  shouldDoBackfill: async () => collectionPath && doBackfill,
  extensionInstanceId: config.instanceId,
};

export const backfillHandler = functions.tasks
  .taskQueue()
  .onDispatch(
    taskThreadTaskHandler<string>(
      async (chunk) => ({ success: 0 }),
      backfillOptions.queueName,
      backfillOptions.extensionInstanceId
    )
  );

export const importDocumentsHandler = async (
  chunk: string[]
): Promise<{ success: number }> => {
  const runtime = getExtensions().runtime();

  if (!config.doBackfill || !config.importCollectionPath) {
    await runtime.setProcessingState(
      "PROCESSING_COMPLETE",
      "Completed. No existing documents imported into BigQuery."
    );
    return { success: 0 };
  }

  const db = getFirestore(config.databaseId);
  const docsRef = chunk.map((docPath) => db.doc(docPath));

  const snapshots = await Promise.all(docsRef.map((docRef) => docRef.get()));

  const rows = snapshots.map((snapshot) => {
    return {
      timestamp: new Date().toISOString(),
      operation: ChangeType.IMPORT,
      documentName: `projects/${config.bqProjectId}/databases/(default)/documents/${snapshot.ref.path}`,
      documentId: snapshot.id,
      eventId: "",
      pathParams: resolveWildcardIds(
        config.importCollectionPath,
        snapshot.ref.path
      ),
      data: eventTracker.serializeData(snapshot.data()),
    };
  });

  try {
    await eventTracker.record(rows);
  } catch (err: any) {
    functions.logger.log(err);
  }

  const success = rows.length;

  if (success > 0) {
    await runtime.setProcessingState(
      "PROCESSING_COMPLETE",
      `Successfully imported ${success} documents into BigQuery`
    );
  }

  await eventTracker.recordCompletionEvent({ context: {} });

  return { success };
};
