import * as functions from "firebase-functions";
import config from "../../../config";
import { getFunctions } from "firebase-admin/functions";

const { queueName } = config.backfillOptions;
const extensionInstanceId = config.instanceId;

export async function createExportTask(data: string[]) {
  try {
    const queue = getFunctions().taskQueue(queueName, extensionInstanceId);
    await queue.enqueue({ paths: data });
    functions.logger.log(`Task created with ${data.length} documents.`);
  } catch (error) {
    functions.logger.error("Error creating task:", error);
  }
}
