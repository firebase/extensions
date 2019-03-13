/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const functions = require('firebase-functions');

// Removes siblings of the node that element that triggered the function if
// there are more than MAX_COUNT.
exports.truncate = functions.database.ref().onCreate(async (snapshot, context) => {
  const parentRef = snapshot.ref.parent;
  const snap = await parentRef.once('value');

  console.log(`Node has ${snap.numChildren()} children, at ${context.resource}`);
  if (snap.numChildren() >= process.env.MAX_COUNT) {
    let childCount = 0;
    const updates = {};
    snap.forEach((child) => {
      if (++childCount <= snap.numChildren() - process.env.MAX_COUNT) {
        updates[child.key] = null;
      }
    });
    // Update the parent. This effectively removes the extra children.
    return parentRef.update(updates).then(() => {
      console.log(`Truncated db to ${process.env.MAX_COUNT} items`);
    });
  }

  console.log('No children deleted.');
  return null;
});
