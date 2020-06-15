/*
 * This template contains a HTTP function that responds with a greeting when called
 *
 * Always use the FUNCTIONS HANDLER NAMESPACE
 * when writing Cloud Functions for extensions.
 * Learn more about the handler namespace in the docs
 *
 * Reference PARAMETERS in your functions code with:
 * `process.env.<parameter-name>`
 * Learn more about parameters in the docs
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { PubSub } from "@google-cloud/pubsub";

admin.initializeApp();
const pubsub = new PubSub();

interface QueuedMessage {
  state: "PENDING" | "PROCESSING" | "DELIVERED" | "ERRORED";
  error?: {
    message: string;
    status?: string;
  };
  deliverTime: admin.firestore.Timestamp;
  topic?: string;
  invalidAfterTime?: admin.firestore.Timestamp;
  data: any;
}

const BATCH_SIZE = 100;
const QUEUE_COLLECTION = process.env.QUEUE_COLLECTION || "queued_messages";
const PUBSUB_TOPIC = process.env.PUBSUB_TOPIC;
const STALENESS_THRESHOLD_SECONDS = parseInt(
  process.env.STALENESS_THRESHOLD_SECONDS || "0",
  10
);
const CLEANUP_POLICY: "DELETE" | "KEEP" =
  (process.env.CLEANUP_POLICY as "DELETE" | "KEEP") || "DELETE";

const queueRef = admin.firestore().collection(QUEUE_COLLECTION);

async function fetchAndProcess(): Promise<void> {
  const toProcess = await queueRef
    .where("state", "==", "PENDING")
    .where("deliverTime", "<=", admin.firestore.Timestamp.now())
    .orderBy("deliverTime")
    .limit(BATCH_SIZE)
    .get();

  if (toProcess.docs.length === 0) {
    console.info("No messages to process.");
    return;
  }

  const promises = toProcess.docs.map((doc) => {
    return processMessage(doc.ref, doc.data() as QueuedMessage);
  });

  const results = await Promise.all(promises);
  let successCount = 0;
  for (const result of results) {
    if (result.success) {
      successCount++;
      continue;
    }

    console.error(
      `Failed to deliver "${QUEUE_COLLECTION}/${result.id}":`,
      result.error
    );
  }
  console.info(`Delivered ${successCount} queued messages.`);

  if (toProcess.docs.length === BATCH_SIZE) {
    return fetchAndProcess();
  }
}

interface ProcessResult {
  id: string;
  success: boolean;
  error?: Error;
}

function isStale(message: QueuedMessage): boolean {
  return (
    (message.invalidAfterTime &&
      message.invalidAfterTime.toMillis() < Date.now()) ||
    (STALENESS_THRESHOLD_SECONDS > 0 &&
      message.deliverTime.toMillis() + STALENESS_THRESHOLD_SECONDS * 1000 <
        Date.now())
  );
}

async function processMessage(
  ref: FirebaseFirestore.DocumentReference,
  message: QueuedMessage
): Promise<ProcessResult> {
  let error;
  try {
    if (!message.topic && !PUBSUB_TOPIC) {
      throw new Error("no PubSub topic was specified for this message");
    }

    await admin.firestore().runTransaction(async (txn) => {
      const message = await txn.get(ref);
      if (message.get("state") !== "PENDING") {
        throw new Error(
          `expected PENDING state but was ${message.get("state")}`
        );
      }

      return txn.update(ref, {
        state: "PROCESSING",
        attempts: admin.firestore.FieldValue.increment(1),
        startTime: admin.firestore.FieldValue.serverTimestamp(),
        updateTime: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    if (isStale(message)) {
      console.warn(
        `Message "${QUEUE_COLLECTION}/${ref.id}" is past invalidAfterTime, skipped delivery.`
      );
    } else {
      await pubsub
        .topic(message.topic || PUBSUB_TOPIC!)
        .publishJSON(message.data);
      console.info(`Delivered message "${QUEUE_COLLECTION}/${ref.id}"`);
    }

    switch (CLEANUP_POLICY) {
      case "DELETE":
        await ref.delete();
      case "KEEP":
        await ref.update({
          state: "SUCCEEDED",
          updateTime: admin.firestore.FieldValue.serverTimestamp(),
          endTime: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
  } catch (e) {
    error = e;
    await ref.update({
      state: "FAILED",
      error: { message: e.message },
      updateTime: admin.firestore.FieldValue.serverTimestamp(),
      endTime: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { success: !!error, error, id: ref.id };
}

async function resetStuck(): Promise<void> {
  const stuck = await queueRef
    .where("state", "==", "PROCESSING")
    .where("leaseExpireTime", "<=", admin.firestore.Timestamp.now())
    .limit(BATCH_SIZE)
    .select()
    .get();

  await Promise.all(
    stuck.docs.map(async (doc) => {
      await doc.ref.update({
        state: "PENDING",
        timeouts: admin.firestore.FieldValue.increment(1),
        lastTimeoutTime: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.error(
        `Message "${QUEUE_COLLECTION}/${doc.id}" was still PROCESSING after lease expired. Reset to PENDING.`
      );
    })
  );

  if (stuck.docs.length === BATCH_SIZE) {
    return resetStuck();
  }
}

exports.deliverMessages = functions.handler.pubsub.schedule.onRun(async () => {
  await resetStuck();
  await fetchAndProcess();
});
