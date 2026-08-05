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

import { type DocumentReference, FieldPath } from "firebase-admin/firestore";

export const hasValidUserPath = async (
  ref: DocumentReference,
  path: string,
  uid: string,
  searchFields: string
): Promise<boolean> => {
  if (path.includes(uid)) return true;
  if (searchFields.length === 0) return false;

  const snapshot = await ref.get();
  if (snapshot.exists) {
    for (const field of searchFields.split(",").filter(Boolean)) {
      const fieldValue = snapshot.get(new FieldPath(field));
      if (typeof fieldValue === "string" && fieldValue.includes(uid)) {
        return true;
      }
    }
  }

  return false;
};

export const extractUserPaths = (paths: string, uid: string): string[] =>
  paths.split(",").map((path) => path.replace(/{UID}/g, uid));
