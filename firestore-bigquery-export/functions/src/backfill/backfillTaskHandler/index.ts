import * as functions from "firebase-functions";
import config from "../../config";
import * as admin from "firebase-admin";
const firestore = admin.firestore();
import { eventTracker } from "../../event_tracker";
import { resolveWildcardIds } from "../../util";
import { chunkArray } from "../chunkArray";
import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";
import { isTimeExceeded } from "./isTimeExceeded";
import { createExportTask } from "../backfillTriggerHandler/utils/createExportTask";

const { batchSize } = config.backfillOptions;

export const backfillTaskHandler = async (
  task: any,
  _ctx: functions.tasks.TaskContext
) => {
  const startTime = performance.now();

  const { paths } = task;
  const chunks: string[][] = chunkArray(paths, batchSize);
  let chunkIndex = 0;
  let chunk: string[] = [];
  try {
    while (chunkIndex < chunks.length) {
      if (isTimeExceeded(startTime)) {
        const remainingPaths = chunks.slice(chunkIndex).flat();

        await createExportTask(remainingPaths);
        break;
      }

      chunk = chunks[chunkIndex] as string[];

      const docRefs = [];
      for (const docPath of chunk) {
        docRefs.push(firestore.doc(docPath));
      }

      const documents = await firestore.getAll(...docRefs);

      if (isTimeExceeded(startTime)) {
        const remainingPaths = chunks.slice(chunkIndex).flat();

        await createExportTask(remainingPaths);
        break;
      }

      const rows = [];
      for (const doc of documents) {
        if (!doc.exists) {
          functions.logger.error(
            `Document ${doc.ref.path} does not exist. Skipping.`
          );
          continue;
        }
        rows.push({
          timestamp: new Date().toISOString(),
          operation: ChangeType.IMPORT,
          documentName: `projects/${config.bqProjectId}/databases/(default)/documents/${doc.ref.path}`,
          documentId: doc.id,
          eventId: "",
          pathParams: resolveWildcardIds(
            config.backfillOptions.collectionPath,
            doc.id
          ),
          data: eventTracker.serializeData(doc.data() || {}),
        });
      }
      await eventTracker.record(rows, true);

      if (isTimeExceeded(startTime)) {
        // we have processed the current chunk, but we have run out of time
        const remainingPaths = chunks.slice(chunkIndex + 1).flat();

        await createExportTask(remainingPaths);
        break;
      }

      chunkIndex++;
    }
  } catch (error) {
    functions.logger.error("Error handling task:", error);
  }
};
