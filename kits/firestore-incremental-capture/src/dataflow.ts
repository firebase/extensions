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

import { FlexTemplatesServiceClient } from "@google-cloud/dataflow";
import { getFirestore } from "firebase-admin/firestore";
import {
  type ResolvedCaptureConfig,
  toPipelineCollectionId,
} from "./capture-config";
import type { RestorationJob, RestorationRequest } from "./handlers";
import * as logs from "./logs";

/**
 * Launches the Dataflow restoration pipeline.
 */
export class RestorationLauncher {
  /**
   * @param config - The resolved capture configuration.
   * @param client - Dataflow flex templates client, injectable for tests.
   */
  constructor(
    private readonly config: ResolvedCaptureConfig,
    private readonly client: FlexTemplatesServiceClient = new FlexTemplatesServiceClient()
  ) {}

  /**
   * Launches a restoration job and records the run in Firestore.
   *
   * The flex template must already be staged at
   * {@link ResolvedCaptureConfig.flexTemplatePath}; see the kit's setup script.
   * Launching against a missing template fails here rather than at deploy.
   *
   * The run id is derived from the target timestamp rather than the wall clock,
   * so it is stable across task-queue retries. Dataflow rejects a duplicate
   * active job name, which is what stops a retry after a partial failure - the
   * launch succeeded but the status write did not - from starting a second job
   * that writes over the backup database concurrently.
   *
   * @param request - The validated restoration request.
   * @returns The launched job.
   */
  async launch(request: RestorationRequest): Promise<RestorationJob> {
    const { config } = this;
    const runId = `${config.instanceId}-restore-${request.timestamp}`;

    logs.info(`Launching restoration job ${runId}`, {
      labels: { run_id: runId },
    });

    const [response] = await this.client.launchFlexTemplate({
      projectId: config.projectId,
      location: config.dataflowRegion,
      launchParameter: {
        jobName: runId,
        parameters: {
          timestamp: request.timestamp.toString(),
          firestoreCollectionId: toPipelineCollectionId(
            config.syncCollectionPath
          ),
          firestoreDb: config.backupInstanceId,
          bigQueryDataset: config.datasetId,
          bigQueryTable: config.tableId,
        },
        containerSpecGcsPath: config.flexTemplatePath,
      },
    });

    const jobName = response.job?.name ?? undefined;

    await getFirestore(config.databaseId)
      .collection(config.restoreCollection)
      .doc(runId)
      .set({
        runId,
        jobName: jobName ?? null,
        timestamp: request.timestamp,
        status: "launched",
      });

    return { runId, jobName };
  }
}
