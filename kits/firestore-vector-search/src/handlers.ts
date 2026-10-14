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

import { isDeepStrictEqual } from "node:util";
import {
  type DocumentSnapshot,
  FieldPath,
  FieldValue,
} from "firebase-admin/firestore";
import { getFunctions } from "firebase-admin/functions";
import type { Change, FirestoreEvent } from "firebase-functions/v2/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import type { Request } from "firebase-functions/v2/tasks";
import { logger } from "firebase-functions";
import {
  type BackfillMetadata,
  type BackfillProcess,
  type BackfillTaskData,
  DEFAULT_BATCH_SIZE,
  type BackfillDocumentData,
  enqueueTaskThread,
  runBackfillTask,
  readMetadataDoc,
  recordMetadataDoc,
} from "./backfill";
import { createEmbedClient } from "./embeddings";
import type { ResolvedVectorSearchConfig } from "./export-config";
import * as logs from "./logs";
import {
  FirestoreVectorStoreClient,
  parseLimit,
  parsePrefilters,
  parseQuerySchema,
  performTextQuery,
} from "./queries";
import { createIndex } from "./queries/setup";

export interface HandlerContext {
  firestore: FirebaseFirestore.Firestore;
  config: ResolvedVectorSearchConfig;
}

export type VectorTaskData = BackfillTaskData;

export type VectorWriteEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  Record<string, string>
>;

/**
 * States the extension's `FirestoreOnWriteProcessor` treated as final. A
 * document that has reached one of these is never processed again, so each
 * document is embedded once and a failure is never retried.
 *
 * `FAILED_BACKFILL`, which the extension's backfill handler wrote, is
 * deliberately absent: the extension left such a document to `embedOnWrite`,
 * which embedded it on the next write to its input field.
 */
const TERMINAL_STATES = new Set([
  "PROCESSING",
  "COMPLETED",
  "ERROR",
  "BACKFILLED",
]);

/**
 * The extension keyed each document's status by the id of the process that
 * wrote it, which for the embedding process was the extension instance id:
 *
 * ```
 * status: { <instance id>: { state, startTime, updateTime, completeTime, createTime } }
 * ```
 *
 * The kit writes the same path, using the kit instance id, so a collection an
 * installed extension embedded needs no migration when the kit instance keeps
 * the extension's instance name.
 */
function statusPath(
  config: ResolvedVectorSearchConfig,
  ...rest: string[]
): FieldPath {
  return new FieldPath(config.statusFieldName, config.instanceId, ...rest);
}

function rawStatusState(
  data: FirebaseFirestore.DocumentData,
  config: ResolvedVectorSearchConfig
): unknown {
  const status = data[config.statusFieldName] as
    | Record<string, { state?: unknown } | undefined>
    | undefined;
  return status?.[config.instanceId]?.state;
}

function isInTerminalState(
  data: FirebaseFirestore.DocumentData,
  config: ResolvedVectorSearchConfig
): boolean {
  // The extension tested `[...].includes(state)` on the raw value, so anything
  // that is not one of the four strings falls through to the input checks.
  const state = rawStatusState(data, config);
  return typeof state === "string" && TERMINAL_STATES.has(state);
}

/**
 * `queueName` is the deployed function's export name. The Admin SDK prefixes it
 * with `kit-<instance id>-` from FIREBASE_KIT_INSTANCE_ID when it resolves the
 * queue, so a name that already carries the prefix resolves to a queue that
 * does not exist.
 */
function queuePath(
  config: ResolvedVectorSearchConfig,
  queueName: string
): string {
  const region = config.region ?? process.env.FUNCTION_REGION;
  if (!region) {
    throw new Error("FUNCTION_REGION is required to resolve task queues.");
  }
  return `locations/${region}/functions/${queueName}`;
}

function embedClient(ctx: HandlerContext) {
  return createEmbedClient(ctx.config);
}

function vectorStore(ctx: HandlerContext) {
  return new FirestoreVectorStoreClient(
    ctx.firestore,
    ctx.config.distanceMeasure
  );
}

export async function handleEmbedOnWrite(
  event: VectorWriteEvent,
  ctx: HandlerContext
): Promise<void> {
  if (!event.data?.after.exists) return;
  logs.start("embedOnWrite");

  const after = event.data.after;
  const data = after.data() ?? {};
  if (isInTerminalState(data, ctx.config)) return;
  const input = data[ctx.config.inputFieldName];
  // The extension's `shouldProcess` required a truthy string, so an empty input
  // was skipped and the document was left with no status at all. Embedding it
  // here would write a terminal status that the guard above never releases, and
  // filling the input in later would no longer embed the document.
  if (typeof input !== "string" || input === "") return;
  // The extension declared `fieldDependencyArray: [inputField]`, and its
  // `Process.shouldProcess` ran only when one of those fields changed. A write
  // that leaves the input untouched is therefore not embedded, which is also
  // what stops the status writes below from re-entering this handler.
  const before = event.data.before.exists
    ? event.data.before.data()
    : undefined;
  if (before && before[ctx.config.inputFieldName] === input) return;

  // The extension's `writeStartEvent` marked the document in flight before
  // embedding it, and the guard above treats `PROCESSING` as final, so a
  // crashed embed leaves the document parked in that state.
  const startTime = FieldValue.serverTimestamp();
  const existingCreateTime = (
    data[ctx.config.statusFieldName] as
      | Record<string, { createTime?: unknown } | undefined>
      | undefined
  )?.[ctx.config.instanceId]?.createTime;
  await after.ref.update(statusPath(ctx.config), {
    state: "PROCESSING",
    startTime,
    // `writeStartEvent` used `startData || change.after.createTime`, so a stored
    // value that is falsy but present is replaced rather than carried forward.
    createTime: existingCreateTime || after.createTime,
    updateTime: startTime,
  });

  try {
    const embedding = await embedClient(ctx).getSingleEmbedding(input);
    const updateTime = FieldValue.serverTimestamp();
    await after.ref.update(
      ctx.config.outputFieldName,
      FieldValue.vector(embedding),
      statusPath(ctx.config, "state"),
      "COMPLETED",
      statusPath(ctx.config, "updateTime"),
      updateTime,
      statusPath(ctx.config, "completeTime"),
      updateTime
    );
    logs.complete("embedOnWrite");
  } catch (err) {
    // The extension recorded the failure on the document and returned, leaving
    // the error itself only in the logs. Rethrowing would mark the invocation
    // failed and, with retries enabled, re-embed from the same stale event.
    await after.ref.update(
      statusPath(ctx.config, "state"),
      "ERROR",
      statusPath(ctx.config, "updateTime"),
      FieldValue.serverTimestamp()
    );
    logs.error("embedOnWrite", err);
  }
}

export async function handleQueryOnWrite(
  event: VectorWriteEvent,
  ctx: HandlerContext
): Promise<void> {
  if (!event.data?.after.exists) return;
  const data = event.data.after.data() ?? {};
  const query = data.query;
  if (typeof query !== "string") return;

  // All three keys are always present (null for absent fields) so the merge
  // write below fully replaces a previously stored request.
  const request = {
    query,
    limit: data.limit ?? null,
    prefilters: data.prefilters ?? null,
  };

  // The result write below re-fires this trigger. The status field stores the
  // request that produced the current result; comparing against that stored
  // record (not the event's before snapshot) lets a stale overwrite from a
  // slow concurrent run mismatch and self-heal on the next trigger.
  const status = data[ctx.config.statusFieldName];
  const storedRequest =
    typeof status === "object" && status !== null
      ? (status as { request?: unknown }).request
      : undefined;
  if (data.result && isDeepStrictEqual(storedRequest, request)) return;

  const result = await performTextQuery({
    query,
    limit: data.limit ? parseLimit(data.limit) : ctx.config.defaultQueryLimit,
    prefilters: parsePrefilters(data.prefilters),
    embedClient: embedClient(ctx),
    vectorStore: vectorStore(ctx),
    config: ctx.config,
  });

  await event.data.after.ref.set(
    {
      ...result,
      [ctx.config.statusFieldName]: { state: "COMPLETED", request },
    },
    { merge: true }
  );
}

export async function handleQueryCall(
  request: CallableRequest<unknown>,
  ctx: HandlerContext
): Promise<{ ids: string[] }> {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const queryParams = parseQuerySchema(request.data);
  const limit = queryParams.limit
    ? parseLimit(queryParams.limit)
    : ctx.config.defaultQueryLimit;
  const result = await performTextQuery({
    query: queryParams.query,
    limit,
    prefilters: queryParams.prefilters ?? [],
    embedClient: embedClient(ctx),
    vectorStore: vectorStore(ctx),
    config: ctx.config,
  });
  return result.result;
}

export async function handleInit(ctx: HandlerContext): Promise<void> {
  await createIndex({
    collectionName: ctx.config.collectionPath,
    dimension: ctx.config.dimension,
    projectId: ctx.config.projectId,
    fieldPath: ctx.config.outputFieldName,
  });

  if (ctx.config.doBackfill) {
    await enqueueBackfillTrigger(ctx);
    // The two passes share one task thread on the index metadata document, and
    // the backfill pass covers every document the update pass would. Running
    // both at once would have them overwrite each other's progress.
    return;
  }
  if (ctx.config.updateOnConfigure) {
    await enqueueUpdateTrigger(ctx);
  }
}

export async function handleBackfillTrigger(
  _request: Request<unknown>,
  ctx: HandlerContext
): Promise<void> {
  await runTrigger(ctx, ctx.config.queueNames.backfillTask);
}

export async function handleUpdateTrigger(
  _request: Request<unknown>,
  ctx: HandlerContext
): Promise<void> {
  await runTrigger(ctx, ctx.config.queueNames.updateTask);
}

export async function handleBackfillTask(
  request: Request<VectorTaskData>,
  ctx: HandlerContext
): Promise<void> {
  await runBackfillTask({
    data: request.data,
    process: embedProcess(ctx),
    options: backfillOptions(ctx),
    queue: taskQueue(ctx, ctx.config.queueNames.backfillTask),
    instanceId: ctx.config.instanceId,
  });
}

export async function handleUpdateTask(
  request: Request<VectorTaskData>,
  ctx: HandlerContext
): Promise<void> {
  await runBackfillTask({
    data: request.data,
    process: updateEmbedProcess(ctx),
    options: backfillOptions(ctx),
    queue: taskQueue(ctx, ctx.config.queueNames.updateTask),
    instanceId: ctx.config.instanceId,
  });
}

/**
 * Gates the pass on the index metadata document, enumerates the collection by
 * reference, and hands the document ids to the task thread.
 */
async function runTrigger(
  ctx: HandlerContext,
  taskQueueName: string
): Promise<void> {
  // Resolved first so a missing region fails the trigger rather than being
  // logged and swallowed below.
  const queue = taskQueue(ctx, taskQueueName);
  const { path, shouldBackfill } = await readMetadataDoc(
    ctx.firestore,
    ctx.config.indexMetadataDocumentPath,
    metadataFor(ctx)
  );

  if (!shouldBackfill) {
    logger.info(
      `Embedding configuration is unchanged for ${ctx.config.collectionPath}, no pass required.`
    );
    return;
  }

  try {
    const refs = await ctx.firestore
      .collection(ctx.config.collectionPath)
      .listDocuments();

    if (refs.length === 0) {
      logger.info(
        `No documents found in the collection ${ctx.config.collectionPath} 📚`
      );
      // Nothing to embed, so the configuration counts as covered. The extension
      // recorded it here too.
      await recordMetadataDoc(ctx.firestore, path, metadataFor(ctx));
      return;
    }

    logger.info(
      `Found ${refs.length} documents in the collection ${ctx.config.collectionPath} 📚`
    );
    logger.info("Enqueuing backfill tasks 🚀");

    await enqueueTaskThread({
      firestore: ctx.firestore,
      tasksDoc: path,
      queue,
      taskParams: refs.map((ref) => ref.id),
      instanceId: ctx.config.instanceId,
    });

    // Only once the thread is dispatched. Recording it earlier would close the
    // gate on a pass that never started, and the error below is swallowed, so
    // no later deploy would reopen it.
    await recordMetadataDoc(ctx.firestore, path, metadataFor(ctx));
  } catch (err) {
    logger.error("Error with backfill trigger");
    logger.error(err);
  }
}

function taskQueue(ctx: HandlerContext, queueName: string) {
  return getFunctions().taskQueue<BackfillTaskData>(
    queuePath(ctx.config, queueName)
  );
}

function backfillOptions(ctx: HandlerContext) {
  return {
    firestore: ctx.firestore,
    collectionName: ctx.config.collectionPath,
    statusField: ctx.config.statusFieldName,
  };
}

function metadataFor(ctx: HandlerContext): BackfillMetadata {
  return {
    collectionName: ctx.config.collectionPath,
    instanceId: ctx.config.instanceId,
    embeddingProvider: ctx.config.embeddingProvider,
    dimension: ctx.config.dimension,
    inputField: ctx.config.inputFieldName,
    outputField: ctx.config.outputFieldName,
  };
}

function hasStringInput(data: BackfillDocumentData, field: string): boolean {
  const value = data[field];
  return !!value && typeof value === "string";
}

/** The backfill pass: embeds a whole batch of documents in one call. */
function embedProcess(ctx: HandlerContext): BackfillProcess {
  const client = embedClient(ctx);
  const { inputFieldName, outputFieldName } = ctx.config;
  const embedOne = async (
    data: BackfillDocumentData
  ): Promise<BackfillDocumentData> => ({
    [outputFieldName]: FieldValue.vector(
      await client.getSingleEmbedding(data[inputFieldName] as string)
    ),
  });

  return {
    id: ctx.config.instanceId,
    batchSize: client.batchSize,
    shouldBackfill: (data) => hasStringInput(data, inputFieldName),
    processFn: embedOne,
    batchFn: async (docs) => {
      const embeddings = await client.getEmbeddings(
        docs.map((doc) => doc[inputFieldName] as string)
      );
      return embeddings.map((embedding) => ({
        [outputFieldName]: FieldValue.vector(embedding),
      }));
    },
  };
}

/**
 * The update pass: only documents that already carry an embedding, and one
 * embedding call per document, as the extension's update process did.
 */
function updateEmbedProcess(ctx: HandlerContext): BackfillProcess {
  const client = embedClient(ctx);
  const { inputFieldName, outputFieldName } = ctx.config;

  return {
    id: ctx.config.instanceId,
    batchSize: DEFAULT_BATCH_SIZE,
    shouldBackfill: (data) =>
      hasStringInput(data, inputFieldName) && !!data[outputFieldName],
    processFn: async (data) => ({
      [outputFieldName]: FieldValue.vector(
        await client.getSingleEmbedding(data[inputFieldName] as string)
      ),
    }),
  };
}

async function enqueueBackfillTrigger(ctx: HandlerContext): Promise<void> {
  await getFunctions()
    .taskQueue(queuePath(ctx.config, ctx.config.queueNames.backfillTrigger))
    .enqueue({});
}

async function enqueueUpdateTrigger(ctx: HandlerContext): Promise<void> {
  await getFunctions()
    .taskQueue(queuePath(ctx.config, ctx.config.queueNames.updateTrigger))
    .enqueue({});
}
