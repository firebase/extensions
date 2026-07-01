import {
  defineBoolean,
  defineInt,
  defineString,
  projectID,
} from "firebase-functions/params";
import type { DeleteUserDataConfig } from "./export-config";

const params = {
  firestorePaths: defineString("FIRESTORE_PATHS", { default: "" }),
  firestoreDatabaseId: defineString("FIRESTORE_DATABASE_ID", {
    default: "(default)",
  }),
  firestoreDeleteMode: defineString("FIRESTORE_DELETE_MODE", {
    default: "shallow",
  }),
  rtdbInstance: defineString("SELECTED_DATABASE_INSTANCE", { default: "" }),
  rtdbLocation: defineString("SELECTED_DATABASE_LOCATION", {
    default: "us-central1",
  }),
  rtdbPaths: defineString("RTDB_PATHS", { default: "" }),
  storageBucket: defineString("CLOUD_STORAGE_BUCKET", { default: "" }),
  storagePaths: defineString("STORAGE_PATHS", { default: "" }),
  enableAutoDiscovery: defineBoolean("ENABLE_AUTO_DISCOVERY", {
    default: false,
  }),
  searchDepth: defineInt("AUTO_DISCOVERY_SEARCH_DEPTH", { default: 3 }),
  searchFields: defineString("AUTO_DISCOVERY_SEARCH_FIELDS", {
    default: "id,uid,userId",
  }),
  searchFunction: defineString("SEARCH_FUNCTION", { default: "" }),
  instanceId: defineString("EXT_INSTANCE_ID", { default: "delete-user-data" }),
  discoveryTopicName: defineString("DISCOVERY_TOPIC_NAME", { default: "" }),
  deletionTopicName: defineString("DELETION_TOPIC_NAME", { default: "" }),
  region: defineString("LOCATION", { default: "us-central1" }),
};

function optional(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

export function configFromEnv(): DeleteUserDataConfig {
  return {
    firestorePaths: optional(params.firestorePaths.value()),
    firestoreDatabaseId: params.firestoreDatabaseId.value(),
    firestoreDeleteMode:
      params.firestoreDeleteMode.value() as DeleteUserDataConfig["firestoreDeleteMode"],
    rtdbInstance: optional(params.rtdbInstance.value()),
    rtdbLocation: optional(params.rtdbLocation.value()),
    rtdbPaths: optional(params.rtdbPaths.value()),
    storageBucket:
      optional(params.storageBucket.value()) ?? process.env.STORAGE_BUCKET,
    storagePaths: optional(params.storagePaths.value()),
    enableAutoDiscovery: params.enableAutoDiscovery.value(),
    searchDepth: params.searchDepth.value(),
    searchFields: params.searchFields.value(),
    searchFunction: optional(params.searchFunction.value()),
    instanceId: params.instanceId.value(),
    discoveryTopicName: optional(params.discoveryTopicName.value()),
    deletionTopicName: optional(params.deletionTopicName.value()),
    region: params.region.value(),
    projectId: projectID.value(),
  };
}
