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

import { DocumentSnapshot } from "firebase-functions/lib/v1/providers/firestore";
import { Change } from "firebase-functions";

import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";

/**
 * Get the change type (CREATE, UPDATE, DELETE) from the Firestore change.
 * @param change Firestore document change object.
 * @returns {ChangeType} The type of change.
 */
export function getChangeType(change: Change<DocumentSnapshot>): ChangeType {
  if (!change.after.exists) {
    return ChangeType.DELETE;
  }
  if (!change.before.exists) {
    return ChangeType.CREATE;
  }
  return ChangeType.UPDATE;
}

/**
 * Get the document ID from the Firestore change.
 * @param change Firestore document change object.
 * @returns {string} The document ID.
 */
export function getDocumentId(change: Change<DocumentSnapshot>): string {
  if (change.after.exists) {
    return change.after.id;
  }
  return change.before.id;
}

/**
 *
 * @param template - eg, regions/{regionId}/countries
 * @param text - eg, regions/asia/countries
 *
 * @return - eg, { regionId: "asia" }
 */
export const resolveWildcardIds = (template: string, text: string) => {
  const textSegments = text.split("/");
  return template
    .split("/")
    .reduce((previousValue, currentValue, currentIndex) => {
      if (currentValue.startsWith("{") && currentValue.endsWith("}")) {
        previousValue[currentValue.slice(1, -1)] = textSegments[currentIndex];
      }
      return previousValue;
    }, {});
};
