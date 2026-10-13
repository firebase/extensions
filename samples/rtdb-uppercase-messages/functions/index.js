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

import { database, tasks, logger } from "firebase-functions/v1";

import { initializeApp } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import { getEventarc } from "firebase-admin/eventarc";
import { getExtensions } from "firebase-admin/extensions";
import { getFunctions } from "firebase-admin/functions";

const app = initializeApp();

// Listens for new messages added to /messages/{pushId}/original and creates an
// uppercase version of the message to /messages/{pushId}/uppercase
// for all databases in 'us-central1'
export const makeuppercase = database
  .ref(process.env.MESSAGE_PATH)
  .onCreate(async (snapshot, context) => {
    logger.log("Found new message at ", snapshot.ref);

    // Grab the current value of what was written to the Realtime Database.
    const original = snapshot.val();

    // Convert it to upper case.
    logger.log("Uppercasing", context.params.pushId, original);
    const uppercase = original.toUpperCase();

    // Setting an "uppercase" sibling in the Realtime Database.
    const upperRef = snapshot.ref.parent.child("upper");
    await upperRef.set(uppercase);

    // Set eventChannel to a newly-initialized channel, or `undefined` if
    // events aren't enabled.
    const eventChannel =
      process.env.EVENTARC_CHANNEL &&
      getEventarc().channel(process.env.EVENTARC_CHANNEL, {
        allowedEventTypes: process.env.EXT_SELECTED_EVENTS,
      });

    // If events are enabled, publish a `complete` event to the configured
    // channel.
    eventChannel &&
      eventChannel.publish({
        type: "test-publisher.rtdb-uppercase-messages.v1.complete",
        subject: upperRef.toString(),
        data: {
          original: original,
          uppercase: uppercase,
        },
      });
  });

export const backfilldata = tasks.taskQueue().onDispatch(async () => {
  if (!process.env.DO_BACKFILL) {
    return getExtensions()
      .runtime()
      .setProcessingState("PROCESSING_COMPLETE", "Backfill skipped.");
  }

  const batch = await getDatabase()
    .ref(process.env.MESSAGE_PATH)
    .parent.parent.orderByChild("upper")
    .limitToFirst(20)
    .get();

  const promises = [];
  for (const key in batch.val()) {
    const msg = batch.child(key);
    if (msg.hasChild("original") && !msg.hasChild("upper")) {
      const upper = msg.child("original").val().toUpperCase();
      promises.push(msg.child("upper").ref.set(upper));
    }
  }
  await Promise.all(promises);

  if (promises.length > 0) {
    const queue = getFunctions().taskQueue(
      `locations/${process.env.LOCATION}/functions/backfilldata`,
      process.env.EXT_INSTANCE_ID
    );
    return queue.enqueue({});
  } else {
    return getExtensions()
      .runtime()
      .setProcessingState("PROCESSING_COMPLETE", "Backfill complete.");
  }
});
