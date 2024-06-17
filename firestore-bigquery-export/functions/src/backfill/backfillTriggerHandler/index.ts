import * as functions from "firebase-functions";
import { createExportTask } from "./utils/createExportTask";
import { eventTracker } from "../../event_tracker";
import { getLastDoc } from "./utils/getLastDoc";
import { isTimeExceeded } from "./utils/isTimeExceeded";
import { saveCompletionFlag } from "./utils/saveCompletionFlag";
import { getDocumentsBatch } from "./utils/getDocumentsBatch";
import { enqueueNextTriggerTask } from "./enqueueNextTriggerTask";

export const backfillTriggerHandler = async (
  data: any,
  _ctx: functions.tasks.TaskContext
) => {
  await eventTracker.initialize();

  let lastDoc = await getLastDoc(data.lastDoc);
  const startTime = performance.now();

  try {
    while (true) {
      if (isTimeExceeded(startTime)) {
        await enqueueNextTriggerTask(lastDoc);
        break;
      }

      const { snapshot, newLastDoc } = await getDocumentsBatch(lastDoc);

      if (snapshot.empty) {
        await saveCompletionFlag();
        functions.logger.log("Backfill completed successfully.");
        break;
      }

      try {
        const currentChunk = snapshot.docs.map((doc) => doc.ref.path);
        await createExportTask(currentChunk);
      } catch (taskError) {
        functions.logger.error("Error creating task:", taskError, {
          documents: snapshot.docs.map((doc) => doc.ref.path),
        });
        throw taskError;
      }

      lastDoc = newLastDoc;

      if (isTimeExceeded(startTime)) {
        await enqueueNextTriggerTask(lastDoc);
        break;
      }
    }
  } catch (error) {
    functions.logger.error("Error during backfill:", error);
  }
};
