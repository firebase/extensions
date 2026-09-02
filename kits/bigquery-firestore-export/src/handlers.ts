/*
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

import type { BigQuery } from "@google-cloud/bigquery";
import type { PubSub } from "@google-cloud/pubsub";
import type { Firestore } from "firebase-admin/firestore";
import type { CloudEvent } from "firebase-functions/v2";
import type { MessagePublishedData } from "firebase-functions/v2/pubsub";
import {
  createTransferConfig,
  type DataTransferClient,
  getTransferConfig,
  updateNotificationTopic,
  updateTransferConfig,
} from "./dts";
import type { ResolvedBigqueryFirestoreExportConfig } from "./export-config";
import { handleTransferRunMessage, parseTransferConfigName } from "./helper";
import * as logs from "./logs";
import type { TransferRunPayload } from "./types";

export type TransferRunEvent = CloudEvent<
  MessagePublishedData<TransferRunPayload>
>;

/** External services used by both handlers, injected for testability. */
export interface HandlerContext {
  db: Firestore;
  bigquery: BigQuery;
  dataTransfer: DataTransferClient;
  pubsub: PubSub;
  config: ResolvedBigqueryFirestoreExportConfig;
}

async function ensureNotificationTopic(ctx: HandlerContext): Promise<void> {
  const topic = ctx.pubsub.topic(ctx.config.pubSubTopic);
  const [exists] = await topic.exists();
  if (exists) return;

  try {
    await ctx.pubsub.createTopic(ctx.config.pubSubTopic);
    logs.topicCreated(ctx.config.pubSubTopic);
  } catch (err) {
    // A concurrent init can create the same topic between exists() and create().
    if (
      typeof err !== "object" ||
      err === null ||
      !("code" in err) ||
      err.code !== 6
    ) {
      throw err;
    }
  }
}

async function storeTransferConfig(
  ctx: HandlerContext,
  transferConfig: Awaited<ReturnType<typeof getTransferConfig>>
): Promise<void> {
  if (!transferConfig?.name) {
    throw new Error("BigQuery transfer config is missing its resource name");
  }
  const { transferConfigId } = parseTransferConfigName(transferConfig.name);
  await ctx.db
    .collection(ctx.config.firestoreCollection)
    .doc(transferConfigId)
    .set({ extInstanceId: ctx.config.instanceId, ...transferConfig });
}

/** Handles a v2 Pub/Sub completion notification from BigQuery DTS. */
export async function handleMessagePublished(
  event: TransferRunEvent,
  ctx: HandlerContext
): Promise<void> {
  logs.start();
  try {
    await handleTransferRunMessage(ctx, { json: event.data.message.json });
    logs.complete();
  } catch (err) {
    logs.error(err);
    throw err;
  }
}

/** Idempotently creates, links, or updates this deployment's DTS config. */
export async function handleUpsertTransferConfig(
  ctx: HandlerContext
): Promise<void> {
  await ensureNotificationTopic(ctx);

  if (ctx.config.transferConfigName) {
    const linked = await getTransferConfig(
      ctx.dataTransfer,
      ctx.config.transferConfigName
    );
    if (!linked) {
      throw new Error(
        `Transfer config not found: ${ctx.config.transferConfigName}`
      );
    }
    const notifying = await updateNotificationTopic(
      ctx.dataTransfer,
      linked,
      ctx.config
    );
    await storeTransferConfig(ctx, notifying);
    return;
  }

  const existing = await ctx.db
    .collection(ctx.config.firestoreCollection)
    .where("extInstanceId", "==", ctx.config.instanceId)
    .limit(1)
    .get();

  if (existing.empty) {
    const created = await createTransferConfig(ctx.dataTransfer, ctx.config);
    await storeTransferConfig(ctx, created);
    return;
  }

  const transferConfigName = existing.docs[0].data().name;
  if (typeof transferConfigName !== "string" || !transferConfigName) {
    throw new Error(
      `Existing transfer config document in ${ctx.config.firestoreCollection} is missing required 'name' field.`
    );
  }

  const updated = await updateTransferConfig(
    ctx.dataTransfer,
    transferConfigName,
    ctx.config
  );
  await storeTransferConfig(ctx, updated);
}
