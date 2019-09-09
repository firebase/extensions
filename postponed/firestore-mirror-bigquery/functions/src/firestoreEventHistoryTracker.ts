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

import { DocumentSnapshot } from 'firebase-functions/lib/providers/firestore';
import {Change, EventContext, } from "firebase-functions";

export enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
  IMPORT,
}

export interface FirestoreDocumentChangeEvent {
  timestamp: Date;
  operation: ChangeType;
  documentName: string;
  eventId: string;
  data: Object;
}

export interface FirestoreEventHistoryTracker {
  record(event: FirestoreDocumentChangeEvent[]);
}

export function getChangeType(change: Change<DocumentSnapshot>): ChangeType {
  if (!change.after.exists) {
    return ChangeType.DELETE;
  }
  if (!change.before.exists) {
    return ChangeType.CREATE;
  }
  return ChangeType.UPDATE;
}

export function getTimestamp(context: EventContext, change: Change<DocumentSnapshot>): Date {
  const changeType = getChangeType((change));
  switch (changeType) {
    case ChangeType.CREATE:
      return change.after.updateTime.toDate();
    case ChangeType.DELETE:
      // Due to an internal bug (129264426), before.update_time is actually the commit timestamp.
      return new Date(change.before.updateTime.toDate().getTime() + 1);
    case ChangeType.UPDATE:
      return change.after.updateTime.toDate();
    default: {
      throw new Error(`Invalid change type: ${changeType}`);
    }
  }
}

