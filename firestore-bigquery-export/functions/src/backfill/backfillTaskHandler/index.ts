import * as functions from "firebase-functions";
import config from "../../config";
import * as admin from "firebase-admin";
const firestore = admin.firestore();
import { eventTracker } from "../../event_tracker";
import { resolveWildcardIds } from "../../util";
import { chunkArray } from "../chunkArray";
import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";

export const backfillTaskHandler = async (
  task: any,
  _ctx: functions.tasks.TaskContext
) => {
  const { paths } = task;
  const chunks = chunkArray(paths, 500);
  let chunkIndex = 0;
  let chunk: string[] = [];
  try {
    while (chunkIndex < chunks.length) {
      chunk = chunks[chunkIndex] as string[];

      const docRefs = chunk.map((docPath) => firestore.doc(docPath));

      const documents = await firestore.getAll(...docRefs);

      const rows = documents
        .filter((doc) => doc.exists)
        .map((doc) => {
          const data = doc.data() || {};

          return {
            timestamp: new Date().toISOString(),
            operation: ChangeType.IMPORT,
            documentName: `projects/${config.bqProjectId}/databases/(default)/documents/${doc.ref.path}`,
            documentId: doc.id,
            eventId: "",
            pathParams: resolveWildcardIds(
              config.backfillOptions.collectionPath,
              doc.id
            ),
            data: eventTracker.serializeData(data),
          };
        });
      await eventTracker.record(rows);

      chunkIndex++;
    }
  } catch (error) {
    functions.logger.error("Error handling task:", error);
  }
};
