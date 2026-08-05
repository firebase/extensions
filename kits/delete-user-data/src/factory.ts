import { PubSub } from "@google-cloud/pubsub";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as functionsV1 from "firebase-functions/v1";
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import * as events from "./events";
import {
  type DeleteUserDataConfig,
  getDatabaseUrl,
  resolveDeleteUserDataConfig,
} from "./export-config";
import {
  type HandlerContext,
  handleClear,
  handleDeletion,
  handleSearch,
} from "./handlers";
import * as logs from "./logs";

export const metadata = {
  roles: [
    "roles/datastore.owner",
    "roles/firebasedatabase.admin",
    "roles/storage.admin",
    "roles/pubsub.admin",
    "roles/eventarc.eventReceiver",
  ],
  functionNames: ["clearData", "handleSearch", "handleDeletion"],
} as const;

export function defineDeleteUserData(config: DeleteUserDataConfig) {
  const resolved = resolveDeleteUserDataConfig(config);
  const databaseURL = getDatabaseUrl(
    resolved.rtdbInstance,
    resolved.rtdbLocation
  );

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      ...(databaseURL ? { databaseURL } : {}),
    });
  }

  events.setupEventChannel();
  logs.init(resolved);

  const ctx: HandlerContext = {
    firestore: getFirestore(resolved.firestoreDatabaseId),
    storage: admin.storage(),
    database: admin.database(),
    pubsub: new PubSub({ projectId: resolved.projectId }),
    config: resolved,
  };

  const clearData = functionsV1.auth.user().onDelete((user) => {
    return handleClear(user.uid, ctx);
  });

  const handleSearchFunction = onMessagePublished(
    {
      topic: resolved.discoveryTopicName,
      region: resolved.region,
    },
    (event) => handleSearch(event.data.message.json, ctx)
  );

  const handleDeletionFunction = onMessagePublished(
    {
      topic: resolved.deletionTopicName,
      region: resolved.region,
    },
    (event) => handleDeletion(event.data.message.json, ctx)
  );

  return {
    clearData,
    handleSearch: handleSearchFunction,
    handleDeletion: handleDeletionFunction,
  };
}
