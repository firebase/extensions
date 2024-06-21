import * as functions from "firebase-functions";
import config from "../../config";
import { getFunctions } from "firebase-admin/functions";
const { triggerQueueName } = config.backfillOptions;
const extensionInstanceId = config.instanceId;

export const enqueueNextTriggerTask = async ({
  lastDoc,
  startPolling,
}: {
  lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null;
  startPolling: boolean;
}) => {
  const task = { lastDoc: lastDoc ? lastDoc.ref.path : null, startPolling };
  try {
    const queue = getFunctions().taskQueue(
      triggerQueueName,
      extensionInstanceId
    );
    await queue.enqueue(task);
    functions.logger.log("Enqueued next function with lastDoc.");
  } catch (error) {
    functions.logger.error("Error enqueuing next function:", error);
  }
};
