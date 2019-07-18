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

import * as logs from "../logs";

export const extractIdFieldNames = (collectionPath: string): string[] => {
  let idFieldNames = [];
  if (collectionPath.includes("/")) {
    idFieldNames = collectionPath
      // Find the params surrounded by `{` and `}`
      .match(/{[^}]*}/g)
      // Strip the `{` and `}` characters
      .map((fieldName) => fieldName.substring(1, fieldName.length - 1));
  }
  return idFieldNames;
};

export const extractIdFieldValues = (
  snapshot: firebase.firestore.DocumentSnapshot,
  idFieldNames: string[]
) => {
  // Extract the values of any `idFieldNames` specifed in the collection path
  let docRef = snapshot.ref;
  const idFieldValues = {
    id: docRef.id,
  };
  let { id } = docRef;
  for (let i = 0; i < idFieldNames.length; i++) {
    docRef = docRef.parent.parent;
    idFieldValues[idFieldNames[i]] = docRef.id;
    id = `${docRef.id}.${id}`;
  }

  return {
    id,
    idFieldValues,
  };
};

export const extractTimestamp = (
  data: Object,
  defaultTimestamp: string,
  timestampField?: string
): string => {
  // If a `timestampField` is specified in the schema then we use the value
  // of the field as the timestamp, rather than the default timestamp
  let timestamp;
  if (timestampField) {
    timestamp = _.get(data, timestampField);
    if (!timestamp) {
      logs.timestampMissingValue(timestampField);
    }
  }
  return timestamp || defaultTimestamp;
};
