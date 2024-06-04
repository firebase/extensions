import {
  FirestoreBackfillOptions,
  taskThreadTaskHandler,
} from "@invertase/firebase-extension-utilities";
import * as functions from "firebase-functions";
import config from "../config";
import { getFirestore } from "firebase-admin/firestore";
import { getExtensions } from "firebase-admin/extensions";
import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";
import { resolveWildcardIds } from "../util";
import { eventTracker } from "../event_tracker";
import * as eventArc from "../event_arc";

const { queueName, metadataDocumentPath, doBackfill, collectionPath } =
  config.backfillOptions;

const backfillOptions: FirestoreBackfillOptions = {
  queueName,
  collectionName: collectionPath,
  metadataDocumentPath,
  shouldDoBackfill: async () => collectionPath && doBackfill,
  extensionInstanceId: config.instanceId,
};

export const importDocumentsHandler = async (
  chunk: string[]
): Promise<{ success: number; failed: number }> => {
  const runtime = getExtensions().runtime();

  if (!config.doBackfill || !config.importCollectionPath) {
    await runtime.setProcessingState(
      "PROCESSING_COMPLETE",
      "Completed. No existing documents imported into BigQuery."
    );
    return { success: 0, failed: 0 };
  }

  const db = getFirestore(config.databaseId);
  const docsRef = chunk.map((docPath) =>
    db.collection(config.backfillOptions.collectionPath).doc(docPath)
  );

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
  const failed = chunk.length - success;

  if (success > 0) {
    await runtime.setProcessingState(
      "PROCESSING_COMPLETE",
      `Successfully imported ${success} documents into BigQuery`
    );
  }

  await eventArc.recordCompletionEvent({ context: {} });

  return { success, failed };
};

export const backfillHandler = functions.tasks.taskQueue().onDispatch(
  taskThreadTaskHandler<string>(importDocumentsHandler, {
    queueName: backfillOptions.queueName,
    extensionInstanceId: backfillOptions.extensionInstanceId,
    onComplete: async (total: number) => {
      const runtime = getExtensions().runtime();

      await runtime.setProcessingState(
        "PROCESSING_COMPLETE",
        `Successfully imported ${total} documents into BigQuery`
      );
    },
  })
);
