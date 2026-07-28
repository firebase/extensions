/*
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
  type DocumentSnapshot,
  FieldValue,
  type GeoPoint,
  type Timestamp,
} from "firebase-admin/firestore";
import type { Change } from "firebase-functions/firestore";

/** A Firestore document write, as delivered by the v2 `onDocumentWritten` event. */
export type DocumentChange = Change<DocumentSnapshot>;

export enum ChangeType {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
}

export enum State {
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
}

export type FirestoreField =
  | string
  | number
  | boolean
  | Timestamp
  | Array<any>
  | Record<string, any>
  | GeoPoint
  | undefined
  | null;

/** A server timestamp sentinel. */
export const now = () => FieldValue.serverTimestamp();

export interface ProcessConfig<
  TInput,
  TOutput extends Record<string, FirestoreField>
> {
  inputField: string;
  processFn: (val: TInput, after: DocumentSnapshot) => Promise<TOutput>;
  errorFn: (e: unknown) => string;
  statusField?: string;
  orderField?: string;
}

export const getChangeType = (change: DocumentChange): ChangeType => {
  if (!change.before?.exists) {
    return ChangeType.CREATE;
  }
  if (!change.after?.exists) {
    return ChangeType.DELETE;
  }
  return ChangeType.UPDATE;
};

export const isDelete = (change: DocumentChange) =>
  getChangeType(change) === ChangeType.DELETE;

export const isUpdate = (change: DocumentChange) =>
  getChangeType(change) === ChangeType.UPDATE;

export const isCreate = (change: DocumentChange) =>
  getChangeType(change) === ChangeType.CREATE;
