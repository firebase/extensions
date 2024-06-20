import * as functions from "firebase-functions";
import { createExportTask } from "./utils/createExportTask";
import { eventTracker } from "../../event_tracker";
import { getLastDoc } from "./utils/getLastDoc";
import { isTimeExceeded } from "./utils/isTimeExceeded";
import { saveCompletionFlag } from "./utils/saveCompletionFlag";
import { getDocumentsBatch } from "./utils/getDocumentsBatch";
import { enqueueNextTriggerTask } from "./enqueueNextTriggerTask";

const logger = functions.logger;

export const backfillTriggerHandler = async (
  data: any,
  _ctx: functions.tasks.TaskContext
) => {
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
        await enqueueNextTriggerTask(lastDoc);
        break;
      }

      const { snapshot, newLastDoc } = await getDocumentsBatch(lastDoc);
      logger.info("Fetched documents batch.", { lastDoc, newLastDoc });

      if (snapshot.empty) {
        logger.info("Document snapshot is empty. Saving completion flag.");
        await saveCompletionFlag();
        logger.log("Backfill completed successfully.");
        break;
      }

      try {
        const currentChunk = snapshot.docs.map((doc) => doc.ref.path);
        logger.info("Creating export task for current chunk.", {
          currentChunk,
        });
        await createExportTask(currentChunk);
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
        await enqueueNextTriggerTask(lastDoc);
        break;
      }
    }
  } catch (error) {
    logger.error("Error during backfill.", { error });
  }
};
