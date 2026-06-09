import fetch from "node-fetch";
import * as logs from "./logs";
import type { PublisherContext } from "./pubsub";
import { runBatchPubSubDeletions } from "./pubsub";

export const runCustomSearchFunction = async (
  uid: string,
  ctx: PublisherContext
): Promise<void> => {
  if (!ctx.config.searchFunction) return;

  const response = await fetch(ctx.config.searchFunction, {
    method: "POST",
    body: JSON.stringify({ uid }),
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    logs.customFunctionError(new Error(body));
    return;
  }

  const json = await response.json();
  if (Array.isArray(json)) {
    return runBatchPubSubDeletions({ firestorePaths: json }, uid, ctx);
  }

  return runBatchPubSubDeletions(
    json as { firestorePaths: string[] },
    uid,
    ctx
  );
};
