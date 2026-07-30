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
import type { Change, FirestoreEvent } from "firebase-functions/v2/firestore";
import type { ScheduledEvent } from "firebase-functions/v2/scheduler";
import { ControllerStatus, ShardedCounterController } from "./controller";
import * as events from "./events";
import type { ResolvedCounterConfig } from "./export-config";
import { ShardedCounterWorker } from "./worker";

export const SHARDS_COLLECTION_ID = "_counter_shards_";
const INLINE_AGGREGATION_LIMIT = 200;
const INLINE_AGGREGATION_TIMEOUT_MS = 60000;

export interface HandlerContext {
  firestore: Firestore;
  config: ResolvedCounterConfig;
}

export type CounterWriteEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  Record<string, string>
>;

export async function handleSchedule(
  _event: ScheduledEvent,
  ctx: HandlerContext
): Promise<void> {
  const metadocRef = ctx.firestore.doc(ctx.config.internalStatePath);
  const controller = new ShardedCounterController(
    metadocRef,
    SHARDS_COLLECTION_ID
  );
  const status = await controller.aggregateOnce(
    { start: "", end: "" },
    INLINE_AGGREGATION_LIMIT
  );
  if (
    status === ControllerStatus.WORKERS_RUNNING ||
    status === ControllerStatus.TOO_MANY_SHARDS ||
    status === ControllerStatus.FAILURE
  ) {
    await controller.rescheduleWorkers();
  }
}

export async function handleShardWrite(
  event: CounterWriteEvent,
  ctx: HandlerContext
): Promise<void> {
  await events.recordStartEvent({ data: event.data, params: event.params });
  const metadocRef = ctx.firestore.doc(ctx.config.internalStatePath);
  const controller = new ShardedCounterController(
    metadocRef,
    SHARDS_COLLECTION_ID
  );
  await controller.aggregateContinuously(
    { start: "", end: "" },
    INLINE_AGGREGATION_LIMIT,
    INLINE_AGGREGATION_TIMEOUT_MS
  );
  await events.recordCompletionEvent({ params: event.params });
}

export async function handleWorker(event: CounterWriteEvent): Promise<void> {
  if (!event.data?.after.exists) {
    return;
  }

  const worker = new ShardedCounterWorker(
    event.data.after,
    SHARDS_COLLECTION_ID
  );
  await worker.run();
}
