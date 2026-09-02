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

import { type DocumentSnapshot, FieldValue } from "firebase-admin/firestore";
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
  updateOrCreateMetadataDoc,
} from "./backfill";
import { createEmbedClient } from "./embeddings";
import * as events from "./events";
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
  await events.recordStartEvent({ params: event.params });
  logs.start("embedOnWrite");

  const data = event.data.after.data() ?? {};
  const input = data[ctx.config.inputFieldName];
  if (typeof input !== "string") return;
  const beforeInput = event.data.before.exists
    ? event.data.before.get(ctx.config.inputFieldName)
    : undefined;
  if (beforeInput === input && data[ctx.config.outputFieldName]) return;

  try {
    const embedding = await embedClient(ctx).getSingleEmbedding(input);
    await event.data.after.ref.set(
      {
        [ctx.config.outputFieldName]: FieldValue.vector(embedding),
        [ctx.config.statusFieldName]: { state: "COMPLETED" },
      },
      { merge: true }
    );
    await events.recordSuccessEvent({
      subject: event.data.after.ref.path,
      data: { outputFieldName: ctx.config.outputFieldName },
    });
    logs.complete("embedOnWrite");
  } catch (err) {
    await event.data.after.ref.set(
      {
        [ctx.config.statusFieldName]: {
          state: "ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { merge: true }
    );
    await events.recordErrorEvent(err as Error);
    logs.error("embedOnWrite", err);
    throw err;
  } finally {
    await events.recordCompletionEvent({ params: event.params });
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

  const result = await performTextQuery({
    query,
    limit: data.limit ? parseLimit(data.limit) : ctx.config.defaultQueryLimit,
    prefilters: parsePrefilters(data.prefilters),
    embedClient: embedClient(ctx),
    vectorStore: vectorStore(ctx),
    config: ctx.config,
  });

  await event.data.after.ref.set(result, { merge: true });
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
  const { path, shouldBackfill } = await updateOrCreateMetadataDoc(
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
      return;
    }

    logger.info(
      `Found ${refs.length} documents in the collection ${ctx.config.collectionPath} 📚`
    );
    logger.info("Enqueuing backfill tasks 🚀");

    await enqueueTaskThread({
      firestore: ctx.firestore,
      tasksDoc: path,
      queue: taskQueue(ctx, taskQueueName),
      taskParams: refs.map((ref) => ref.id),
      instanceId: ctx.config.instanceId,
    });
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
