import * as admin from "firebase-admin";
import fetch from "node-fetch";
import { runBatchPubSubDeletions } from "./runBatchPubSubDeletions";
import config from "./config";

export const runCustomSearchFunction = async (uid: string): Promise<void> => {
  const db = admin.firestore();

  const response = await fetch(config.searchFunction, {
    method: "post",
    body: JSON.stringify({ data: { uid } }),
    headers: { "Content-Type": "application/json" },
  });

  /** Get user resonse **/
  const responseJson = await response.json();

  /** Run pubsub batch */
  await runBatchPubSubDeletions(responseJson);
};
