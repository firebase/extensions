import * as functions from "firebase-functions";
import config from "../../config";
import * as admin from "firebase-admin";
const firestore = admin.firestore();
import { eventTracker } from "../../event_tracker";
import { resolveWildcardIds } from "../../util";
import { chunkArray } from "../utils/chunkArray";
import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";
import { isTimeExceeded } from "../utils/isTimeExceeded";
import { createExportTask } from "../chunkCollection/utils/createExportTask";
import { setProcessingStateComplete } from "../chunkCollection";
import { BackfillMetadata } from "../metadata";
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

  const batches: string[][] = chunkArray(paths, batchSize);

  let batchIndex = 0;
  let batch: string[] = [];
  try {
    while (batchIndex < batches.length) {
      if (isTimeExceeded(startTime)) {
        const remainingPaths = batches.slice(batchIndex).flat();
        logger.info(
          "Time exceeded, creating export task for remaining paths.",
          { remainingPaths }
        );

        await createExportTask(remainingPaths);
        break;
      }

      batch = batches[batchIndex] as string[];
      logger.info("Processing batch.", {
        batchIndex,
        batch,
      });

      const docRefs = [];
      for (const docPath of batch) {
        docRefs.push(firestore.doc(docPath));
      }

      logger.info("Fetching documents for batch.", { docRefs });

      const documents = await firestore.getAll(...docRefs);
      logger.info("Documents fetched.", { documents });

      if (isTimeExceeded(startTime)) {
        const remainingPaths = batches.slice(batchIndex).flat();
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
        // we have processed the current batch, but we have run out of time
        const remainingPaths = batches.slice(batchIndex + 1).flat();
        logger.info(
          "Time exceeded after recording rows, creating export task for remaining paths.",
          { remainingPaths }
        );

        await createExportTask(remainingPaths);
        break;
      }

      batchIndex++;
      logger.info("Moving to next batch.", { batchIndex });
    }

    // All batches processed, increment the chunksProcessed count
    const metadata = await BackfillMetadata.fromFirestore({
      path: `${config.instanceId}/backfillMetadata`,
    });
    try {
      await metadata.incrementChunksProcessed();
      logger.info("Incremented chunksProcessed count.");

      const newMetadata = await BackfillMetadata.fromFirestore({
        path: `${config.instanceId}/backfillMetadata`,
      });

      if (newMetadata.checkIfComplete()) {
        logger.info(
          "All chunks processed, setting processing state to complete."
        );
        await setProcessingStateComplete();
      }
    } catch (error) {
      logger.error("Error incrementing chunksProcessed count.", { error });
      await createExportTask([]);
    }
  } catch (error) {
    logger.error("Error handling task:", { error });
  }
};
