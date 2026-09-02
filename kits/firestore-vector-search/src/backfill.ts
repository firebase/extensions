/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { TaskQueue } from "firebase-admin/functions";
import { logger } from "firebase-functions";

/** Document ids carried by a single backfill task. */
export const TASK_CHUNK_SIZE = 50;

/** Embedding batch size used when a process declares none. */
export const DEFAULT_BATCH_SIZE = 50;

export type BackfillJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

/** The state written onto a document once its backfill pass has finished. */
export const BACKFILLED_STATE = "BACKFILLED";
export const FAILED_BACKFILL_STATE = "FAILED_BACKFILL";

export type DocumentData = Record<string, unknown>;

/** Payload of a `backfillTask` / `updateTask` dispatch. */
export interface BackfillTaskData {
  taskId: string;
  chunk: string[];
  tasksDoc: string;
}

/**
 * The fields compared against the index metadata document to decide whether a
 * backfill pass is required.
 */
export interface BackfillMetadata {
  collectionName: string;
  instanceId: string;
  embeddingProvider: string;
  dimension: number;
  inputField: string;
  outputField: string;
}

/**
 * One backfill pass: how to decide a document is eligible, and how to produce
 * the fields written back onto it.
 */
export interface BackfillProcess {
  id: string;
  batchSize: number;
  shouldBackfill(data: DocumentData): boolean;
  processFn(data: DocumentData): Promise<DocumentData>;
  /**
   * Embeds a whole batch in one call. Processes without one fall back to
   * `processFn` per document, and a single document failing then fails only
   * that document.
   */
  batchFn?(data: DocumentData[]): Promise<DocumentData[]>;
}

export interface BackfillOptions {
  firestore: Firestore;
  collectionName: string;
  statusField: string;
}

export interface ChunkResult {
  success: number;
  failed: number;
  skipped: number;
}

export function chunkArray<T>(array: readonly T[], chunkSize: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}

function isRecord(value: unknown): value is DocumentData {
  return typeof value === "object" && value !== null;
}

function metadataChanged(
  current: DocumentData,
  metadata: BackfillMetadata
): boolean {
  return (
    current.embeddingProvider !== metadata.embeddingProvider ||
    current.dimension !== metadata.dimension ||
    current.inputField !== metadata.inputField ||
    current.outputField !== metadata.outputField
  );
}

/**
 * Reads the index metadata document, decides whether the embedding
 * configuration has changed since the last pass, and records the current
 * configuration when it has.
 *
 * The metadata document doubles as the task-thread progress document, so every
 * write merges rather than replaces. The extension replaced it, which wiped the
 * comparison fields on the first pass and made the gate a no-op from then on.
 */
export async function updateOrCreateMetadataDoc(
  firestore: Firestore,
  metadataDocumentPath: string,
  metadata: BackfillMetadata
): Promise<{ path: string; shouldBackfill: boolean }> {
  logger.info(
    `Fetching existing metadata doc for ${metadata.collectionName} 📝`
  );
  const ref = firestore.doc(metadataDocumentPath);
  const snapshot = await ref.get();
  const record = { ...metadata, createdAt: Timestamp.now() };

  if (!snapshot.exists) {
    logger.info(
      `No existing metadata doc found for ${metadata.collectionName} 📝`
    );
    logger.info("Creating a new metadata doc");
    await ref.set(record, { merge: true });
    return { path: ref.path, shouldBackfill: true };
  }

  const shouldBackfill = metadataChanged(snapshot.data() ?? {}, metadata);
  if (shouldBackfill) {
    logger.info("Updating existing metadata doc");
    await ref.set(record, { merge: true });
  }
  return { path: ref.path, shouldBackfill };
}

/**
 * Writes the progress document, records one enqueue document per chunk of
 * document ids, and dispatches the first task. Each task enqueues its successor
 * once it completes, so only one task is in flight at a time.
 */
export async function enqueueTaskThread(params: {
  firestore: Firestore;
  tasksDoc: string;
  queue: TaskQueue<BackfillTaskData>;
  taskParams: readonly string[];
  instanceId: string;
}): Promise<void> {
  const { firestore, tasksDoc, queue, taskParams, instanceId } = params;

  await firestore.doc(tasksDoc).set(
    {
      backfillJobsTotal: taskParams.length,
      backfillJobsProcessed: 0,
      backfillJobsSkipped: 0,
      backfillJobsFailed: 0,
      backfillStatus: "PENDING" satisfies BackfillJobStatus,
    },
    { merge: true }
  );

  const chunks = chunkArray(taskParams, TASK_CHUNK_SIZE);
  if (chunks.length === 0) {
    return;
  }

  // Record every chunk before dispatching anything. The first task enqueues its
  // successor as soon as it finishes, so a successor that has not been written
  // yet costs the thread a retry.
  let writer = firestore.batch();
  let pendingWrites = 0;

  for (const [index, chunk] of chunks.entries()) {
    const taskId = taskIdFor(instanceId, index + 1);
    writer.set(firestore.doc(`${tasksDoc}/enqueues/${taskId}`), {
      taskId,
      status: "PENDING" satisfies BackfillJobStatus,
      chunk,
    });
    pendingWrites++;

    if (pendingWrites === TASK_CHUNK_SIZE) {
      logger.info("Committing the batch...");
      await writer.commit();
      writer = firestore.batch();
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) {
    logger.info("Committing the batch...");
    await writer.commit();
  }

  const firstTaskId = taskIdFor(instanceId, 1);
  logger.info(`Enqueuing the first task ${firstTaskId} 🚀`);
  await queue.enqueue({
    taskId: firstTaskId,
    chunk: chunks[0],
    tasksDoc,
  });
  await firestore.doc(tasksDoc).update({
    backfillStatus: "RUNNING" satisfies BackfillJobStatus,
  });

  logger.info(`${chunks.length} tasks enqueued successfully 🚀`);
}

function taskIdFor(instanceId: string, counter: number): string {
  return `kit-${instanceId}-task-${counter}`;
}

export function getNextTaskId(prevId: string, instanceId: string): string {
  const pattern = new RegExp(`^kit-${instanceId}-task-\\d+$`);
  if (!pattern.test(prevId)) {
    throw new Error(`Invalid task ID format: ${prevId}`);
  }
  const taskNum = prevId.split("task-")[1];
  return taskIdFor(instanceId, Number.parseInt(taskNum, 10) + 1);
}

/**
 * Runs one dispatched chunk: marks the enqueue document, embeds the chunk,
 * updates the progress counters, and either finishes the thread or dispatches
 * the next task.
 */
export async function runBackfillTask(params: {
  data: BackfillTaskData;
  process: BackfillProcess;
  options: BackfillOptions;
  queue: TaskQueue<BackfillTaskData>;
  instanceId: string;
}): Promise<void> {
  const { data, process, options, queue, instanceId } = params;
  const { firestore } = options;
  const { taskId, chunk, tasksDoc } = data;

  if (!chunk || chunk.length === 0) {
    logger.info("No data to handle, skipping...");
    return;
  }
  logger.info(`Handling ${chunk.length} documents`);

  const taskRef = firestore.doc(`${tasksDoc}/enqueues/${taskId}`);
  await taskRef.update({ status: "PROCESSING" });

  const { success, failed, skipped } = await runChunk(process, chunk, options);

  await taskRef.update({ status: "DONE" satisfies BackfillJobStatus });
  logger.info(`Task ${taskId} completed with ${success} success(es)`);

  const tasksDocSnapshot = await firestore.doc(tasksDoc).get();
  const progress = tasksDocSnapshot.data() ?? {};
  const totalTasks = progress.backfillJobsTotal;
  const processedTasks = progress.backfillJobsProcessed;
  const skippedTasks = progress.backfillJobsSkipped;
  const failedTasks = progress.backfillJobsFailed;

  if (
    [totalTasks, processedTasks, skippedTasks, failedTasks].some(
      (value) => typeof value !== "number"
    )
  ) {
    throw new Error("Invalid task document");
  }

  await firestore.doc(tasksDoc).update({
    backfillJobsFailed: FieldValue.increment(failed),
    backfillJobsSkipped: FieldValue.increment(skipped),
    backfillJobsProcessed: FieldValue.increment(success),
  });

  const processed = (processedTasks as number) + success;
  const totalSkipped = (skippedTasks as number) + skipped;
  const totalFailed = (failedTasks as number) + failed;

  logger.info(
    `Current state: ${processed} processed, ${totalSkipped} skipped, ${totalFailed} failed out of ${totalTasks} total tasks`
  );

  if (processed + totalSkipped + totalFailed === totalTasks) {
    await firestore.doc(tasksDoc).update({
      backfillStatus: "DONE" satisfies BackfillJobStatus,
    });
    return;
  }

  await enqueueNextTask({
    firestore,
    prevId: taskId,
    tasksDoc,
    queue,
    instanceId,
  });
}

async function enqueueNextTask(params: {
  firestore: Firestore;
  prevId: string;
  tasksDoc: string;
  queue: TaskQueue<BackfillTaskData>;
  instanceId: string;
}): Promise<void> {
  const { firestore, prevId, tasksDoc, queue, instanceId } = params;
  const nextId = getNextTaskId(prevId, instanceId);

  const nextTask = await firestore.doc(`${tasksDoc}/enqueues/${nextId}`).get();
  if (!nextTask.exists) {
    logger.error(`Next task document ${nextId} not found.`);
    throw new Error(`Next task document ${nextId} does not exist.`);
  }

  const chunk = nextTask.data()?.chunk;
  if (!Array.isArray(chunk) || chunk.length === 0) {
    logger.error(`Next task ${nextId} has an invalid or empty chunk.`);
    throw new Error(`Next task ${nextId} does not have valid chunk data.`);
  }

  await queue.enqueue({ taskId: nextId, chunk, tasksDoc });
  logger.info(`Successfully enqueued task ${nextId}`);
}

async function runChunk(
  process: BackfillProcess,
  chunk: readonly string[],
  options: BackfillOptions
): Promise<ChunkResult> {
  const { validDocuments, skippedDocuments } = await getValidDocs(
    process,
    chunk,
    options
  );

  if (validDocuments.length === 0) {
    logger.info("No data to handle, skipping...");
    return { success: 0, failed: 0, skipped: skippedDocuments.length };
  }

  logger.info(`Handling ${validDocuments.length} documents`);

  if (validDocuments.length === 1) {
    return handleSingleDocument(
      process,
      validDocuments[0],
      skippedDocuments.length,
      options
    );
  }

  const batches = chunkArray(
    validDocuments,
    process.batchSize || DEFAULT_BATCH_SIZE
  );
  const results = await Promise.allSettled(
    batches.map((batch) => batchProcess(process, batch))
  );

  const writer = options.firestore.batch();
  let failedDocumentsCount = 0;

  results.forEach((result, index) => {
    const batch = batches[index];

    if (result.status === "rejected") {
      // A failed batch means all its documents are considered failed.
      failedDocumentsCount += batch.length;
      logger.error(`Batch ${index + 1} failed`, result.reason);
      for (const doc of batch) {
        writer.update(doc.ref, failedPayload(options));
      }
      return;
    }

    batch.forEach((doc, i) => {
      const fields = result.value[i];
      if (!fields) {
        failedDocumentsCount++;
        writer.update(doc.ref, failedPayload(options));
        return;
      }
      writer.update(doc.ref, {
        ...fields,
        ...backfilledPayload(options),
      });
    });
  });

  await writer.commit();

  return {
    success: validDocuments.length - failedDocumentsCount,
    failed: failedDocumentsCount,
    skipped: skippedDocuments.length,
  };
}

/**
 * Embeds one batch. A process with a `batchFn` embeds the whole batch in a
 * single call, so the batch succeeds or fails as a unit; otherwise each
 * document is embedded on its own and failures are reported per document by
 * leaving that slot empty.
 */
async function batchProcess(
  process: BackfillProcess,
  batch: readonly DocumentSnapshot[]
): Promise<(DocumentData | undefined)[]> {
  const data = batch.map((doc) => doc.data() as DocumentData);

  if (process.batchFn) {
    return process.batchFn(data);
  }

  const results = await Promise.allSettled(data.map(process.processFn));
  return results.map((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    logger.error(result.reason);
    return undefined;
  });
}

export async function getValidDocs(
  process: BackfillProcess,
  documentIds: readonly string[],
  options: BackfillOptions
): Promise<{
  validDocuments: DocumentSnapshot[];
  skippedDocuments: DocumentSnapshot[];
}> {
  const validDocuments: DocumentSnapshot[] = [];
  const skippedDocuments: DocumentSnapshot[] = [];
  const collection = options.firestore.collection(options.collectionName);

  await options.firestore.runTransaction(async (transaction) => {
    const refs = documentIds.map((id) => collection.doc(id));
    const docs = await transaction.getAll(...refs);

    for (const doc of docs) {
      const data = doc.data();

      if (!data || !process.shouldBackfill(data)) {
        skippedDocuments.push(doc);
        logger.warn(
          `Document ${doc.ref.path} is not valid for ${process.id} process`
        );
        continue;
      }

      const status = data[options.statusField];
      const state = isRecord(status) ? status.state : undefined;
      if (state && state !== BACKFILLED_STATE) {
        skippedDocuments.push(doc);
        logger.warn(
          `Document ${doc.ref.path} is not in the correct state to be backfilled`
        );
        continue;
      }

      validDocuments.push(doc);
    }
  });

  return { validDocuments, skippedDocuments };
}

async function handleSingleDocument(
  process: BackfillProcess,
  document: DocumentSnapshot,
  skipped: number,
  options: BackfillOptions
): Promise<ChunkResult> {
  try {
    const result = await process.processFn(document.data() as DocumentData);
    await document.ref.update({
      ...result,
      ...backfilledPayload(options),
    });
    return { success: 1, failed: 0, skipped };
  } catch (err) {
    logger.error(err);
    await document.ref.update(failedPayload(options));
    return { success: 0, failed: 1, skipped };
  }
}

function backfilledPayload(options: BackfillOptions): DocumentData {
  return {
    [`${options.statusField}.state`]: BACKFILLED_STATE,
    [`${options.statusField}.completeTime`]: FieldValue.serverTimestamp(),
  };
}

function failedPayload(options: BackfillOptions): DocumentData {
  return {
    [`${options.statusField}.state`]: FAILED_BACKFILL_STATE,
    [`${options.statusField}.completeTime`]: FieldValue.serverTimestamp(),
  };
}
