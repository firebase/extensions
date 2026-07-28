/*
 * Copyright 2022 Google LLC
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

import { DocumentReference, FieldPath } from "firebase-admin/firestore";
import config from "./config";

export const getDatabaseUrl = (
  selectedDatabaseInstance: string | undefined,
  selectedDatabaseLocation: string | undefined
) => {
  if (!selectedDatabaseLocation || !selectedDatabaseInstance) return null;

  if (selectedDatabaseLocation === "us-central1")
    return `https://${selectedDatabaseInstance}.firebaseio.com`;

  return `https://${selectedDatabaseInstance}.${selectedDatabaseLocation}.firebasedatabase.app`;
};

export const hasValidUserPath = async (
  ref: DocumentReference,
  path: string,
  uid: string
): Promise<boolean> => {
  /** Check path for valid user id */
  if (path.includes(uid)) return true;

  /** Check to find valid field */
  const snapshot = await ref.get();

  if (snapshot.exists) {
    for (const field of config.searchFields.split(",")) {
      const fieldValue = snapshot.get(new FieldPath(field));

      /** Return if a matching string includes the id */
      if (typeof fieldValue === "string" && fieldValue.includes(uid)) {
        return true;
      }
    }
  }

  /** Return as invalid path */
  return false;
};
