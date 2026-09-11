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
import { type DocumentSnapshot, FieldValue } from "firebase-admin/firestore";
import { getFunctions } from "firebase-admin/functions";
import type { Change, FirestoreEvent } from "firebase-functions/v2/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import type { Request } from "firebase-functions/v2/tasks";
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

export interface VectorTaskData {
  path: string;
}

export type VectorWriteEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  Record<string, string>
>;

/**
 * States the extension's `FirestoreOnWriteProcessor` treated as final. A
 * document that has reached one of these is never processed again, so each
 * document is embedded once and a failure is never retried.
 *
 * The kit itself writes only `COMPLETED` and `ERROR`. `PROCESSING` (which the
 * extension's `writeStartEvent` wrote before each embed, as an in-flight
 * marker) and `BACKFILLED` reach this guard only on documents an installed
 * extension instance left behind, and are listed so those are still skipped.
 */
const TERMINAL_STATES = new Set([
  "PROCESSING",
  "COMPLETED",
  "ERROR",
  "BACKFILLED",
]);

function isInTerminalState(
  data: FirebaseFirestore.DocumentData,
  statusFieldName: string
): boolean {
  const status = data[statusFieldName] as { state?: unknown } | undefined;
  const state = status?.state;
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

  const data = event.data.after.data() ?? {};
  if (isInTerminalState(data, ctx.config.statusFieldName)) return;
  const input = data[ctx.config.inputFieldName];
  // The extension's `shouldProcess` required a truthy string, so an empty input
  // was skipped and the document was left with no status at all. Embedding it
  // here would write a terminal status that the guard above never releases, and
  // filling the input in later would no longer embed the document.
  if (typeof input !== "string" || input === "") return;

  try {
    const embedding = await embedClient(ctx).getSingleEmbedding(input);
    await event.data.after.ref.set(
      {
        [ctx.config.outputFieldName]: FieldValue.vector(embedding),
        [ctx.config.statusFieldName]: { state: "COMPLETED" },
      },
      { merge: true }
    );
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
    logs.error("embedOnWrite", err);
    throw err;
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
  // Matches the extension's `shouldBackfill` and `shouldUpdate`, which both
  // required a truthy string, and keeps an empty document out of the terminal
  // status that `handleEmbedOnWrite` would then skip forever.
  if (typeof input !== "string" || input === "") return;
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
