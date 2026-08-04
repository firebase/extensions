/*
 * Copyright 2019 Google LLC
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
import type { v1 } from "@google-cloud/bigquery-data-transfer";
import type { PubSub } from "@google-cloud/pubsub";
import type { Firestore } from "firebase-admin/firestore";
import type { CloudEvent } from "firebase-functions";
import type { MessagePublishedData } from "firebase-functions/pubsub";
import {
  PARTITIONING_FIELD_REMOVAL_ERROR_PREFIX,
  createTransferConfig,
  getTransferConfig,
  parseTransferConfigName,
  parseTransferRunName,
  updateTransferConfig,
} from "./dts";
import type { ResolvedExportConfig } from "./export-config";
import {
  transferConfigAssociatedWithInstance,
  updateLatestRunDocument,
  writeRunResultsToFirestore,
} from "./firestore";
import * as logs from "./logs";
import type { TransferRunMessage, TransferRunPayload } from "./types";

/** A Pub/Sub message-published event for a DTS run notification. */
export type TransferRunEvent = CloudEvent<MessagePublishedData>;

/**
 * Everything the handlers need, injected so they stay unit-testable. The main
 * entry point builds one lazily from env params; consumers owning their own
 * trigger registration construct it directly.
 */
export interface HandlerContext {
  db: Firestore;
  config: ResolvedExportConfig;
  dts: v1.DataTransferServiceClient;
  bigquery: BigQuery;
  pubsub: PubSub;
  /** Resolves the runtime service account email for DTS config creation.
   *  Defaults to a GCE metadata-server lookup; undefined result omits
   *  `serviceAccountName` from the create request. */
  resolveServiceAccountEmail?: () => Promise<string | undefined>;
}

/** gRPC status code for ALREADY_EXISTS. */
const GRPC_ALREADY_EXISTS = 6;

const METADATA_SA_EMAIL_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email";

/**
 * Default runtime service-account lookup via the GCE metadata server.
 * Returns undefined outside Google infrastructure (e.g. the emulator).
 *
 * @returns The service account email, or undefined when unavailable.
 */
export async function metadataServerServiceAccountEmail(): Promise<
  string | undefined
> {
  try {
    const res = await fetch(METADATA_SA_EMAIL_URL, {
      headers: { "Metadata-Flavor": "Google" },
    });
    if (!res.ok) {
      return undefined;
    }
    const email = (await res.text()).trim();
    return email.length > 0 ? email : undefined;
  } catch {
    return undefined;
  }
}

async function ensureTopicExists(ctx: HandlerContext): Promise<void> {
  try {
    await ctx.pubsub.createTopic(ctx.config.pubsubTopic);
  } catch (e) {
    const alreadyExists =
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      e.code === GRPC_ALREADY_EXISTS;
    if (!alreadyExists) {
      throw e;
    }
  }
  logs.topicEnsured(ctx.config.pubsubTopic);
}

/**
 * Handles a DTS run-completion Pub/Sub message: verifies the transfer config
 * belongs to this instance, then on SUCCEEDED copies the run's result table
 * into Firestore; for other states records run metadata only.
 *
 * @param event - The Pub/Sub message event.
 * @param ctx - The handler context.
 */
export async function handleProcessMessage(
  event: TransferRunEvent,
  ctx: HandlerContext
): Promise<void> {
  const payload = event.data.message.json as TransferRunPayload;
  logs.pubsubMessage(payload);
  const message: TransferRunMessage = { json: payload };
  const { db, config, bigquery } = ctx;

  const { transferConfigId, runId } = parseTransferRunName(payload.name);

  const hasValidConfig = await transferConfigAssociatedWithInstance(
    db,
    config,
    transferConfigId
  );

  if (!hasValidConfig) {
    const error = Error(
      `Skipping handling pubsub message because transferConfig '${transferConfigId}' is not associated with instance '${config.instanceId}'.`
    );
    logs.error(error);
    throw error;
  }

  if (payload.state === "SUCCEEDED") {
    await writeRunResultsToFirestore(db, bigquery, config, message);
  } else {
    logs.handlingNonSuccessRun(transferConfigId, runId, payload.state);

    // Explicit zero counts for non-success runs (clearer API shape than
    // omitting them).
    const rowCounts = { failedRowCount: 0, totalRowCount: 0 };

    await db
      .collection(`${config.firestoreCollection}/${transferConfigId}/runs`)
      .doc(runId)
      .set({
        runMetadata: payload,
        ...rowCounts,
      });

    await updateLatestRunDocument(
      db,
      config,
      transferConfigId,
      runId,
      message,
      rowCounts
    );
  }
  logs.pubsubMessageHandled(payload);
}

/**
 * Provisioning task: ensures the notification Pub/Sub topic exists, then
 * reconciles the DTS scheduled query - updating the transfer config already
 * associated with this instance, or creating one - and mirrors the result to
 * `{firestoreCollection}/{transferConfigId}`.
 *
 * Idempotent. Errors throw so Cloud Tasks retries, except a partitioning-field
 * removal, which the DTS API can never accept and is therefore terminal.
 *
 * @param ctx - The handler context.
 */
export async function handleUpsertTransferConfig(
  ctx: HandlerContext
): Promise<void> {
  const { db, config, dts } = ctx;

  try {
    await ensureTopicExists(ctx);
  } catch (e) {
    logs.provisioningFailed("creating the notification Pub/Sub topic", e);
    throw e;
  }

  const q = db
    .collection(config.firestoreCollection)
    .where("extInstanceId", "==", config.instanceId);

  const results = await q.get();

  if (results.size > 0) {
    const existingTransferConfig = results.docs[0].data();
    if (!existingTransferConfig?.name) {
      const error = new Error(
        `Existing transfer config document in ${config.firestoreCollection} is missing required 'name' field.`
      );
      logs.provisioningFailed(
        "reading the existing transfer config doc",
        error
      );
      throw error;
    }
    const transferConfigName = existingTransferConfig.name;
    const { transferConfigId } = parseTransferConfigName(transferConfigName);

    try {
      // serviceAccountName cannot be updated on existing transfer configs, so
      // it is not passed here; it is only set at creation time.
      await updateTransferConfig(dts, transferConfigName, config);

      const updatedConfig = await getTransferConfig(dts, transferConfigName);

      if (!updatedConfig) {
        logs.provisioningFailed(
          "re-fetching the updated transfer config",
          new Error("updated transfer config not found")
        );
        return;
      }

      await db
        .collection(config.firestoreCollection)
        .doc(transferConfigId)
        .set({
          extInstanceId: config.instanceId,
          ...updatedConfig,
        });
      return;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes(PARTITIONING_FIELD_REMOVAL_ERROR_PREFIX)
      ) {
        // Terminal: the DTS API can never accept this update, so retrying the
        // task would loop forever.
        logs.partitioningRemovalTerminal(error.message);
        return;
      }
      logs.provisioningFailed("updating the transfer config", error);
      throw error;
    }
  }

  try {
    const resolveEmail =
      ctx.resolveServiceAccountEmail ?? metadataServerServiceAccountEmail;
    const serviceAccountEmail = await resolveEmail();
    if (!serviceAccountEmail) {
      logs.serviceAccountLookupFailed();
    }

    const transferConfig = await createTransferConfig(
      dts,
      config,
      serviceAccountEmail
    );
    // createTransferConfig guarantees name exists (throws if null).
    const { transferConfigId } = parseTransferConfigName(transferConfig.name!);

    await db
      .collection(config.firestoreCollection)
      .doc(transferConfigId)
      .set({
        extInstanceId: config.instanceId,
        ...transferConfig,
      });
  } catch (error) {
    logs.provisioningFailed("creating the transfer config", error);
    throw error;
  }
}
