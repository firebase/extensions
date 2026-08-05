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

import {
  defineBoolean,
  defineInt,
  defineString,
  projectID,
  select,
  storageBucket,
} from "firebase-functions/params";
import type { DeleteUserDataConfig } from "./export-config";

const params = {
  firestorePaths: defineString("FIRESTORE_PATHS", { default: "" }),
  firestoreDatabaseId: defineString("FIRESTORE_DATABASE_ID", {
    default: "(default)",
  }),
  firestoreDeleteMode: defineString("FIRESTORE_DELETE_MODE", {
    default: "shallow",
    input: select(["recursive", "shallow"]),
  }),
  rtdbInstance: defineString("SELECTED_DATABASE_INSTANCE", { default: "" }),
  rtdbLocation: defineString("SELECTED_DATABASE_LOCATION", {
    default: "us-central1",
    input: select(["us-central1", "europe-west1", "asia-southeast1"]),
  }),
  rtdbPaths: defineString("RTDB_PATHS", { default: "" }),
  storageBucket: defineString("CLOUD_STORAGE_BUCKET", {
    default: storageBucket,
  }),
  storagePaths: defineString("STORAGE_PATHS", { default: "" }),
  enableAutoDiscovery: defineBoolean("ENABLE_AUTO_DISCOVERY", {
    default: false,
  }),
  searchDepth: defineInt("AUTO_DISCOVERY_SEARCH_DEPTH", { default: 3 }),
  searchFields: defineString("AUTO_DISCOVERY_SEARCH_FIELDS", {
    default: "id,uid,userId",
  }),
  searchFunction: defineString("SEARCH_FUNCTION", { default: "" }),
  instanceId: defineString("KIT_INSTANCE_ID", { default: "delete-user-data" }),
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
