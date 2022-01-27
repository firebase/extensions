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

import { DocumentSnapshot } from "firebase-functions/lib/providers/firestore";
import { Change } from "firebase-functions";

import { ChangeType } from "@posiek07/fbct";

export function getChangeType(change: Change<DocumentSnapshot>): ChangeType {
  if (!change.after.exists) {
    return ChangeType.DELETE;
  }
  if (!change.before.exists) {
    return ChangeType.CREATE;
  }
  return ChangeType.UPDATE;
}

export function getDocumentId(change: Change<DocumentSnapshot>): string {
  if (change.after.exists) {
    return change.after.id;
  }
  return change.before.id;
}

export function getDocumentTree(change: Change<DocumentSnapshot>): object {
  if (change.after.exists) {
    return getFirestoreJsonTree(change.after.ref.path);
  }
  return getFirestoreJsonTree(change.before.ref.path);
}

export type FirestoreRefObject = {
  id: string;
  type: "document" | "collection" | "";
  parent: object | null;
};

function getFirestoreJsonTree(path: string) {
  return path.split("/").reduce((acc: object, value, index) => {
    let object: FirestoreRefObject = { id: "", type: "", parent: null };
    if (index % 2 === 1) {
      object.id = value;
      object.type = "document";
    } else {
      object.id = value;
      object.type = "collection";
    }
    object.parent = acc;
    return object;
  }, null);
}
