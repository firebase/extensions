import { CloudTasksClient } from "@google-cloud/tasks";
const client = new CloudTasksClient();
import config from "../../../config";
import * as functions from "firebase-functions";

const logger = functions.logger;
import { getExtensions } from "firebase-admin/extensions";

function setComplete() {
  const runtime = getExtensions().runtime();
  return runtime.setProcessingState(
    "PROCESSING_COMPLETE",
    "Backfill completed successfully."
  );
}

export async function pollBackfillTaskQueue() {
  const request = {
    // TODO: is this bqProjectId or projectId?
    parent: `projects/${config.bqProjectId}/locations/${config.location}/queues/ext-${config.instanceId}-backfillHandler`,
  };

  const [tasklist] = await client.listTasks(request);

  if (tasklist.length > 0) {
    logger.log(`Found ${tasklist.length} tasks on queue!`);
    throw new Error("Backfill task queue is not empty.");
  } else {
    await setComplete();
  }
}
