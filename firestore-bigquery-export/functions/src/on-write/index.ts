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

import config from "../config";
import * as functions from "firebase-functions";
import { getFunctions } from "firebase-admin/functions";

import { ChangeType } from "@firebaseextensions/firestore-bigquery-change-tracker";

import * as logs from "../logs";
import * as eventArc from "../event_arc";
import { getChangeType, getDocumentId, resolveWildcardIds } from "../util";

import { eventTracker } from "../event_tracker";

export const syncBigQuery = functions.tasks
  .taskQueue()
  .onDispatch(
    async ({ context, changeType, documentId, data, oldData }, ctx) => {
      const update = {
        timestamp: context.timestamp, // This is a Cloud Firestore commit timestamp with microsecond precision.
        operation: changeType,
        documentName: context.resource.name,
        documentId: documentId,
        pathParams: config.wildcardIds ? context.params : null,
        eventId: context.eventId,
        data,
        oldData,
      };

      /** Record the chnages in the change tracker */
      await eventTracker.record([{ ...update }]);

      /** Send an event Arc update , if configured */
      await eventArc.recordSuccessEvent({
        subject: documentId,
        data: {
          ...update,
        },
      });

      logs.complete();
    }
  );

export const fsexportbigquery = functions
  .runWith({ failurePolicy: true })
  .firestore.database(config.databaseId)
  .document(config.collectionPath)
  .onWrite(async (change, context) => {
    logs.start();
    try {
      const changeType = getChangeType(change);
      const documentId = getDocumentId(change);

      const isCreated = changeType === ChangeType.CREATE;
      const isDeleted = changeType === ChangeType.DELETE;

      const data = isDeleted ? undefined : change.after.data();
      const oldData =
        isCreated || config.excludeOldData ? undefined : change.before.data();

      await eventArc.recordStartEvent({
        documentId,
        changeType,
        before: {
          data: change.before.data(),
        },
        after: {
          data: change.after.data(),
        },
        context: context.resource,
      });

      const queue = getFunctions().taskQueue(
        `locations/${config.location}/functions/syncBigQuery`,
        config.instanceId
      );

      /**
       * enqueue data cannot currently handle documentdata
       * Serialize early before queueing in clopud task
       * Cloud tasks currently have a limit of 1mb, this also ensures payloads are kept to a minimum
       */
      const serializedData = eventTracker.serializeData(data);
      const serializedOldData = eventTracker.serializeData(oldData);

      await queue.enqueue({
        context,
        changeType,
        documentId,
        data: serializedData,
        oldData: serializedOldData,
      });
    } catch (err) {
      await eventArc.recordErrorEvent(err as Error);
      logs.error(err);
      const eventAgeMs = Date.now() - Date.parse(context.timestamp);
      const eventMaxAgeMs = 10000;

      if (eventAgeMs > eventMaxAgeMs) {
        return;
      }

      throw err;
    }

    logs.complete();
  });
