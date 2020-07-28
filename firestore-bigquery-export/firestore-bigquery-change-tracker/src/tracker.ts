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
import { Change, EventContext } from "firebase-functions";

export enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
  IMPORT,
}

export interface FirestoreDocumentChangeEvent {
  // The timestamp represented in ISO format.
  // Date is not appropriate because it only has millisecond precision.
  // Cloud Firestore timestamps have microsecond precision.
  timestamp: string;
  operation: ChangeType;
  documentName: string;
  eventId: string;
  documentId: string;
  data: Object;
}

export interface FirestoreEventHistoryTracker {
  record(event: FirestoreDocumentChangeEvent[]);
}
