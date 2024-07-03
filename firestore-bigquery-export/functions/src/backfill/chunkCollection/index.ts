import * as functions from "firebase-functions";
import { createExportTask } from "./utils/createExportTask";
import { eventTracker } from "../../event_tracker";
import { getLastDoc } from "./utils/getLastDoc";
import { isTimeExceeded } from "../utils/isTimeExceeded";
import { getDocumentsChunk } from "./utils/getDocumentsChunk";
import { enqueueNextTriggerTask } from "./enqueueNextTriggerTask";
import config from "../../config";
import { getExtensions } from "firebase-admin/extensions";
import { BackfillMetadata } from "../metadata";
const logger = functions.logger;

export function setProcessingStateComplete() {
  const runtime = getExtensions().runtime();
  return runtime.setProcessingState(
    "PROCESSING_COMPLETE",
    "Backfill completed successfully."
  );
}

export const backfillTriggerHandler = async (
  data: any,
  _ctx: functions.tasks.TaskContext
) => {
  if (!config.doBackfill) {
    await setProcessingStateComplete();
    logger.info("Backfill is disabled. Marking completion.");
    return;
  }

  const metadata = await BackfillMetadata.fromFirestore({
    path: `${config.instanceId}/backfillMetadata`,
  });

  logger.info("Backfill trigger handler started.", { data });

  await eventTracker.initialize();
  logger.info("Event tracker initialized.");

  let lastDoc = await getLastDoc(data.lastDoc);
  logger.info("Retrieved last document.", { lastDoc });

  const startTime = performance.now();
  logger.info("Start time recorded.", { startTime });

  try {
    while (true) {
      if (isTimeExceeded(startTime)) {
        logger.info("Time exceeded, enqueueing next trigger task.", {
          lastDoc,
        });
        // await enqueueNextTriggerTask({ lastDoc, startPolling: false });
        await enqueueNextTriggerTask({ lastDoc });
        break;
      }

      const { snapshot, newLastDoc } = await getDocumentsChunk(lastDoc);
      logger.info("Fetched documents batch.", { lastDoc, newLastDoc });

      if (snapshot.empty) {
        logger.log("All backfill tasks enqueued successfully.");
        await metadata.setAllChunksEnqueued();
        break;
      }

      try {
        const currentChunk = snapshot.docs.map((doc) => doc.ref.path);
        await createExportTask(currentChunk);
        await metadata.incrementChunksEnqueued();
      } catch (taskError) {
        logger.error("Error creating task.", {
          taskError,
          documents: snapshot.docs.map((doc) => doc.ref.path),
        });
        throw taskError;
      }

      lastDoc = newLastDoc;
      logger.info("Updated last document.", { lastDoc });

      if (isTimeExceeded(startTime)) {
        logger.info("Time exceeded, enqueueing next trigger task.", {
          lastDoc,
        });
        await enqueueNextTriggerTask({ lastDoc });
        break;
      }
    }
  } catch (error) {
    logger.error("Error during backfill.", { error });
    throw error;
  }
};
