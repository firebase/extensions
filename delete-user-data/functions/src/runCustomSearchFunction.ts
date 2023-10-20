import fetch from "node-fetch";

import config from "./config";
import * as logs from "./logs";
import { runBatchPubSubDeletions } from "./runBatchPubSubDeletions";

export const runCustomSearchFunction = async (uid: string): Promise<void> => {
  const response = await fetch(config.searchFunction, {
    method: "POST",
    body: JSON.stringify({ uid }),
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    logs.customFunctionError(new Error(body));
    return;
  }

  /** Get user resonse **/
  const json = await response.json();

  // Support returning an array directly
  if (Array.isArray(json)) {
    return runBatchPubSubDeletions({ firestorePaths: json }, uid);
  }

  return runBatchPubSubDeletions(json, uid);
};
