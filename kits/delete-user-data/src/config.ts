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
  expr,
  projectID,
  select,
  storageBucket,
} from "firebase-functions/params";
import type { DeleteUserDataConfig } from "./export-config";

const instanceId = defineString("INSTANCE_ID");

const params = {
  instanceId,
  firestorePaths: defineString("FIRESTORE_PATHS", {
    label: "Cloud Firestore paths",
    description:
      "Which paths in your Cloud Firestore instance contain data keyed on a user ID? Leave empty if you don't use Cloud Firestore.\nEnter the full paths, separated by commas. Use `{UID}` as a placeholder for the user's UID.\nFor example, if you have the collections `users` and `admins`, and each collection has documents with User ID as document IDs, then enter `users/{UID},admins/{UID}`.",
    default: "",
    input: { text: { example: "users/{UID},admins/{UID}" } },
  }),
  firestoreDatabaseId: defineString("FIRESTORE_DATABASE_ID", {
    label: "Firestore Database ID",
    description:
      'The ID of the Firestore database to use. Use "(default)" for the default database. You can view your available Firestore databases at https://console.cloud.google.com/firestore/databases.',

    default: "(default)",
  }),
  firestoreDeleteMode: defineString("FIRESTORE_DELETE_MODE", {
    label: "Cloud Firestore delete mode",
    description:
      "(Only applicable if you use the `Cloud Firestore paths` parameter.) How do you want to delete Cloud Firestore documents? To also delete documents in subcollections, set this parameter to `recursive`.",

    default: "shallow",
    input: select({ Recursive: "recursive", Shallow: "shallow" }),
  }),
  rtdbInstance: defineString("SELECTED_DATABASE_INSTANCE", {
    label: "Realtime Database instance",
    description:
      "What is the ID of the Realtime Database instance from which you want to delete user data (keyed on user ID)?",

    default: "",
    input: {
      text: {
        example: "my-instance",

        // Extension regex, with an empty branch added: the param is optional.
        validationRegex: /^(?:[^\.\$\#\]\[\/\x00-\x1F\x7F]+|)$/,
        validationErrorMessage:
          "Invalid database instance. Make sure that you have entered just the instance ID, and not the entire database URL.",
      },
    },
  }),
  rtdbLocation: defineString("SELECTED_DATABASE_LOCATION", {
    label: "Realtime Database location",
    description:
      "(Only applicable if you provided the `Realtime Database instance` parameter.) From which Realtime Database location do you want to delete data keyed on a user ID?",

    default: "us-central1",
    input: select({
      "United States": "us-central1",
      Belgium: "europe-west1",
      Singapore: "asia-southeast1",
    }),
  }),
  rtdbPaths: defineString("RTDB_PATHS", {
    label: "Realtime Database paths",
    description:
      "Which paths in your Realtime Database instance contain data keyed on a user ID? Leave empty if you don't use Realtime Database.\nEnter the full paths, separated by commas. Use `{UID}` as a placeholder for the user's UID.\nFor example: `users/{UID},admins/{UID}`.",
    default: "",
    input: { text: { example: "users/{UID},admins/{UID}" } },
  }),
  storageBucket: defineString("CLOUD_STORAGE_BUCKET", {
    label: "Cloud Storage bucket",
    description:
      "Which Google Cloud Storage bucket do you want to delete files from?",

    default: storageBucket,
    input: {
      text: {
        example: "my-project-12345.appspot.com",

        validationRegex: /^([0-9a-z_.-]*)$/,
        validationErrorMessage: "Invalid storage bucket",
      },
    },
  }),
  storagePaths: defineString("STORAGE_PATHS", {
    label: "Cloud Storage paths",
    description:
      "Where in Google Cloud Storage do you store data keyed on a user ID? Leave empty if you don't use Cloud Storage.\nEnter the full paths to files or directories in your Storage buckets, separated by commas. Use `{UID}` to represent the User ID of the deleted user, and use `{DEFAULT}` to represent your default Storage bucket.\nHere's a series of examples. To delete all the files in your default bucket with the file naming scheme `{UID}-pic.png`, enter `{DEFAULT}/{UID}-pic.png`. To also delete all the files in another bucket called my-app-logs with the file naming scheme `{UID}-logs.txt`, enter `{DEFAULT}/{UID}-pic.png,my-app-logs/{UID}-logs.txt`. To *also* delete a User ID-labeled directory and all its files (like `media/{UID}`), enter `{DEFAULT}/{UID}-pic.png,my-app-logs/{UID}-logs.txt,{DEFAULT}/media/{UID}`.",
    default: "",
    input: {
      text: {
        example: "{DEFAULT}/{UID}-pic.png,my-awesome-app-logs/{UID}-logs.txt",
      },
    },
  }),
  enableAutoDiscovery: defineBoolean("ENABLE_AUTO_DISCOVERY", {
    label: "Enable auto discovery",
    description:
      "Enable the extension to automatically discover Firestore collections and documents to delete.",

    default: false,
  }),
  searchDepth: defineInt("AUTO_DISCOVERY_SEARCH_DEPTH", {
    label: "Auto discovery search depth",
    description:
      "If auto discovery is enabled, how deep should auto discovery find collections and documents. For example, setting to `1` would only discover root collections and documents, whereas setting to `9` would search sub-collections 9 levels deep. Defaults to `3`.",
    default: 3,
  }),
  searchFields: defineString("AUTO_DISCOVERY_SEARCH_FIELDS", {
    label: "Auto discovery search fields",
    description:
      "If auto discovery is enabled, specify what document fields are used to associate the UID with the document. The extension will delete documents where the value for one or more of these fields matches the deleting user’s UID. If left empty, document fields will not be used in auto discovery.",

    default: "id,uid,userId",
  }),
  searchFunction: defineString("SEARCH_FUNCTION", {
    label: "Search function URL",
    description:
      "Specify a URL to call that will return a list of document paths to delete. The extension will send a `POST` request to the specified `URL`, with the `uid` of the deleted user will be provided in the body of the request. The endpoint specified should return an array of firestore paths to delete.",
    default: "",
    input: {
      text: {
        example:
          "https://us-west1-my-project-id.cloudfunctions.net/myTransformFunction",
      },
    },
  }),
  // Non-empty defaults so Pub/Sub trigger bindings resolve during deploy
  // discovery without freezing an empty topic name into the manifest.
  discoveryTopicName: defineString("DISCOVERY_TOPIC_NAME", {
    default: expr`kit-${instanceId}-discovery`,
  }),
  deletionTopicName: defineString("DELETION_TOPIC_NAME", {
    default: expr`kit-${instanceId}-deletion`,
  }),
};

export const CONFIG_EXPRESSIONS = {
  discoveryTopicName: params.discoveryTopicName,
  deletionTopicName: params.deletionTopicName,
} as const;

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
    projectId: projectID.value(),
  };
}
