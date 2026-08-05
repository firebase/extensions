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
import { createEmbedClient } from "./embeddings";
import * as events from "./events";
import type { ResolvedVectorSearchConfig } from "./export-config";
import * as logs from "./logs";
import {
  FirestoreVectorStoreClient,
  type Prefilter,
  parseLimit,
  parseQuerySchema,
  performTextQuery,
} from "./queries";
import { createIndex } from "./queries/setup";

export interface HandlerContext {
  firestore: FirebaseFirestore.Firestore;
  config: ResolvedVectorSearchConfig;
}

export interface VectorTaskData {
  path: string;
}

export type VectorWriteEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  Record<string, string>
>;

function queuePath(
  config: ResolvedVectorSearchConfig,
  queueName: string
): string {
  return `locations/${config.region}/functions/${queueName}`;
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
    prefilters: (data.prefilters as Prefilter[] | undefined) ?? [],
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
  }
  if (ctx.config.updateOnConfigure) {
    await enqueueUpdateTrigger(ctx);
  }
}

export async function handleBackfillTrigger(
  _request: Request<unknown>,
  ctx: HandlerContext
): Promise<void> {
  const snapshot = await ctx.firestore
    .collection(ctx.config.collectionPath)
    .get();
  const queue = getFunctions().taskQueue(
    queuePath(ctx.config, ctx.config.queueNames.backfillTask)
  );
  await Promise.all(
    snapshot.docs.map((doc) => queue.enqueue({ path: doc.ref.path }))
  );
}

export async function handleUpdateTrigger(
  _request: Request<unknown>,
  ctx: HandlerContext
): Promise<void> {
  const snapshot = await ctx.firestore
    .collection(ctx.config.collectionPath)
    .get();
  const queue = getFunctions().taskQueue(
    queuePath(ctx.config, ctx.config.queueNames.updateTask)
  );
  await Promise.all(
    snapshot.docs.map((doc) => queue.enqueue({ path: doc.ref.path }))
  );
}

export async function handleBackfillTask(
  request: Request<VectorTaskData>,
  ctx: HandlerContext
): Promise<void> {
  await embedPath(request.data.path, ctx, false);
}

export async function handleUpdateTask(
  request: Request<VectorTaskData>,
  ctx: HandlerContext
): Promise<void> {
  await embedPath(request.data.path, ctx, true);
}

async function embedPath(
  path: string,
  ctx: HandlerContext,
  requireExistingEmbedding: boolean
): Promise<void> {
  const ref = ctx.firestore.doc(path);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;
  const input = snapshot.get(ctx.config.inputFieldName);
  if (typeof input !== "string") return;
  if (requireExistingEmbedding && !snapshot.get(ctx.config.outputFieldName)) {
    return;
  }
  const embedding = await embedClient(ctx).getSingleEmbedding(input);
  await ref.set(
    {
      [ctx.config.outputFieldName]: FieldValue.vector(embedding),
      [ctx.config.statusFieldName]: { state: "COMPLETED" },
    },
    { merge: true }
  );
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
