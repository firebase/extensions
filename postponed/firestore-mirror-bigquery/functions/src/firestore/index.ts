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

import * as firebase from "firebase-admin";
import * as _ from "lodash";

import * as errors from "../errors";
import * as logs from "../logs";

export type FirestoreFieldType =
  | "boolean"
  | "geopoint"
  | "number"
  | "map"
  | "array"
  | "null"
  | "string"
  | "timestamp";

export type FirestoreField = {
  fields?: FirestoreField[];
  name: string;
  repeated?: boolean;
  type: FirestoreFieldType;
};

export type FirestoreSchema = {
  idField?: string;
  fields: FirestoreField[];
  timestampField?: string;
};

/**
 * Extract the DocumentSnapshot data that matches the fields specified in the
 * schema
 */
export const extractSnapshotData = (
  snapshot: firebase.firestore.DocumentSnapshot,
): Object => {
  return snapshot.data();
};
