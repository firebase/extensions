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
  const data = snapshot.data() ?? {};
  const input = data[ctx.config.inputFieldName];
  // Matches the extension's `shouldBackfill` and `shouldUpdate`, which both
  // required a truthy string, and keeps an empty document out of the terminal
  // status that `handleEmbedOnWrite` would then skip forever.
  if (typeof input !== "string" || input === "") return;
  if (requireExistingEmbedding && !data[ctx.config.outputFieldName]) {
    return;
  }
  // The extension's `getValidDocs` skipped any document that already carried a
  // status other than `BACKFILLED`, so a backfill or an update pass never
  // re-embedded a document `embedOnWrite` had completed or failed. It tested
  // the raw value for truthiness, so an empty or missing state is backfilled
  // and any other non-`BACKFILLED` value is skipped.
  const state = rawStatusState(data, ctx.config);
  if (state && state !== "BACKFILLED") return;

  try {
    const embedding = await embedClient(ctx).getSingleEmbedding(input);
    await ref.update(
      ctx.config.outputFieldName,
      FieldValue.vector(embedding),
      statusPath(ctx.config, "state"),
      "BACKFILLED",
      statusPath(ctx.config, "completeTime"),
      FieldValue.serverTimestamp()
    );
  } catch (err) {
    // The extension marked the document and reported the failure in its task
    // result rather than throwing, so a failed document was not retried.
    await ref.update(
      statusPath(ctx.config, "state"),
      "FAILED_BACKFILL",
      statusPath(ctx.config, "completeTime"),
      FieldValue.serverTimestamp()
    );
    logs.error("backfillTask", err);
  }
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
