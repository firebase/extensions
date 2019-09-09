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

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

import config from "./config";
import * as logs from "./logs";
import { getChangeType, getTimestamp,  getData } from "./change_tracker";
import { Status } from "./error_code";

admin.initializeApp();
const firestore = admin.firestore();
firestore.settings({timestampsInSnapshots: true});

logs.init();

export const fsdocumenthistories = functions.handler.firestore.document.onWrite(
    async (change, context) => {
      logs.start();
      try {
        const documentId = change.after.id? change.after.id: change.before.id;
        const timestamp = getTimestamp(context, change);
        const data = getData(change);
        const historyDocKey = `${config.collectionPath}/${documentId}/${config.subCollectionId}/${timestamp.getTime()}`;
        logs.insertingHistory(historyDocKey, getChangeType(change));
        await firestore.doc(historyDocKey).set(data);
        logs.complete();
      } catch (err) {
        logs.error(err);
        switch (err.code) {
          case Status.DEADLINE_EXCEEDED:
          case Status.ABORTED:
            throw err; // Make function retry.
        }
      }
    }
);
