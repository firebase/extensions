import type { PubSub } from "@google-cloud/pubsub";
import chunk from "lodash.chunk";
import type { ResolvedDeleteUserDataConfig } from "./export-config";

export interface DeletionPaths {
  firestorePaths: string[];
}

export interface PublisherContext {
  pubsub: PubSub;
  config: ResolvedDeleteUserDataConfig;
}

function topicPath(
  config: ResolvedDeleteUserDataConfig,
  topicName: string
): string {
  const projectId =
    config.projectId ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    process.env.PROJECT_ID;
  return projectId ? `projects/${projectId}/topics/${topicName}` : topicName;
}

export async function publishSearch(
  uid: string,
  depth: number,
  path: string,
  ctx: PublisherContext
): Promise<void> {
  await ctx.pubsub
    .topic(topicPath(ctx.config, ctx.config.discoveryTopicName))
    .publishMessage({ json: { path, uid, depth } });
}

export async function runBatchPubSubDeletions(
  paths: DeletionPaths,
  uid: string,
  ctx: PublisherContext
): Promise<void> {
  const { firestorePaths } = paths;
  if (!firestorePaths || !Array.isArray(firestorePaths)) return;
  if (firestorePaths.length === 0) return;

  for (const chunkedPaths of chunk<string>(firestorePaths, 450)) {
    await ctx.pubsub
      .topic(topicPath(ctx.config, ctx.config.deletionTopicName))
      .publishMessage({ json: { paths: chunkedPaths, uid } });
  }
}
