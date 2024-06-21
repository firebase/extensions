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

const logger = functions.logger;

export const backfillTaskHandler = async (
  task: any,
  _ctx: functions.tasks.TaskContext
) => {
  const startTime = performance.now();
  logger.info("Backfill task handler started.", { task });

  const { paths } = task;
  logger.info("Paths received.", { paths });

  const chunks: string[][] = chunkArray(paths, batchSize);
  logger.info("Paths chunked.", { chunks });

  let chunkIndex = 0;
  let chunk: string[] = [];
  try {
    while (chunkIndex < chunks.length) {
      if (isTimeExceeded(startTime)) {
        const remainingPaths = chunks.slice(chunkIndex).flat();
        logger.info(
          "Time exceeded, creating export task for remaining paths.",
          { remainingPaths }
        );

        await createExportTask(remainingPaths);
        break;
      }

      chunk = chunks[chunkIndex] as string[];
      logger.info("Processing chunk.", { chunkIndex, chunk });

      const docRefs = [];
      for (const docPath of chunk) {
        docRefs.push(firestore.doc(docPath));
      }

      logger.info("Fetching documents for chunk.", { docRefs });

      const documents = await firestore.getAll(...docRefs);
      logger.info("Documents fetched.", { documents });

      if (isTimeExceeded(startTime)) {
        const remainingPaths = chunks.slice(chunkIndex).flat();
        logger.info(
          "Time exceeded after fetching documents, creating export task for remaining paths.",
          { remainingPaths }
        );

        await createExportTask(remainingPaths);
        break;
      }

      const rows = [];
      for (const doc of documents) {
        if (!doc.exists) {
          logger.error(`Document ${doc.ref.path} does not exist. Skipping.`);
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
      logger.info("Rows prepared for event tracker.", { rows });

      await eventTracker.record(rows);
      logger.info("Event tracker recorded rows.");

      if (isTimeExceeded(startTime)) {
        // we have processed the current chunk, but we have run out of time
        const remainingPaths = chunks.slice(chunkIndex + 1).flat();
        logger.info(
          "Time exceeded after recording rows, creating export task for remaining paths.",
          { remainingPaths }
        );

        await createExportTask(remainingPaths);
        break;
      }

      chunkIndex++;
      logger.info("Moving to next chunk.", { chunkIndex });
    }
  } catch (error) {
    logger.error("Error handling task:", { error });
  }
};
