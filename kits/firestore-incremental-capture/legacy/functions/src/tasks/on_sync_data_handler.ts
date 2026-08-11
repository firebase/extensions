/**
 * Copyright 2023 Google LLC
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

import * as functions from "firebase-functions";
import { getFunctions } from "firebase-admin/functions";

import config from "../config";
import { firestoreSerializer } from "../utils/firestore_serializer";

const getState = (
  change: functions.Change<functions.firestore.DocumentSnapshot>
) => {
  // return if created
  if (!change.before?.exists) return "CREATE";

  // return if deleted
  if (!change.after?.exists) return "DELETE";

  //else return updated
  return "UPDATE";
};

export const syncDataHandler = async (
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  ctx: functions.EventContext
) => {
  const queue = getFunctions().taskQueue(
    `locations/${config.location}/functions/syncDataTask`,
    config.instanceId
  );

  //state whether the update is an CREATE, UPDATE or DELETE
  const changeType = getState(change);

  // format data
  const beforeData = change.before ? change.before.data() : null;
  const afterData = change.after ? change.after.data() : null;

  // serialize data
  const serializedBeforeData = await firestoreSerializer(beforeData);
  const serializedAfterData = await firestoreSerializer(afterData);

  return queue.enqueue({
    beforeData: JSON.stringify(serializedBeforeData),
    afterData: JSON.stringify(serializedAfterData),
    documentId: change.before?.id || change.after.id,
    documentPath: change.before?.ref?.path || change.after.ref.path,
    timestamp: ctx.timestamp,
    changeType,
  });
};
