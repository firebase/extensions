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
import config from "./config";

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

export function getCollectionPathParams(
  change: Change<DocumentSnapshot>
): object {
  if (change.after.exists) {
    return getWildcardParamsValues(
      change.after.ref.path,
      config.collectionPath
    );
  }
  return getWildcardParamsValues(change.before.ref.path, config.collectionPath);
}

export function getWildcardParamsValues(
  path: string,
  collectionPath: string
): any {
  const pathArray = path
    .split("/")
    .filter(($, i) => i % 2)
    .slice(0, -1);
  const collectionArray = collectionPath.split("/").filter(($, i) => i % 2);
  let pathWildcardArray = [];
  let collectionWildcardArray = [];

  collectionArray.forEach((el, index) => {
    if (el.includes("{")) {
      pathWildcardArray.push(pathArray[index]);
      collectionWildcardArray.push(collectionArray[index].replace(/[{}]/g, ""));
    }
  });
  return convertStringArrayToObj(collectionWildcardArray, pathWildcardArray);
}

function convertStringArrayToObj(a, b) {
  if (a.length != b.length || a.length == 0 || b.length == 0) {
    return null;
  }
  let obj = {};
  a.forEach((k, i) => {
    obj[k] = b[i];
  });
  return obj;
}
