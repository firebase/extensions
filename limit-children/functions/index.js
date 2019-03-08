/**
 * Copyright 2016 Google Inc. All Rights Reserved.
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
exports.truncate = functions.database.ref(process.env.PARENT_NODE_PATH).onWrite(async (change) => {
  const parentRef = change.after.ref.parent;
  const snapshot = await parentRef.once('value');

  console.log(`Node has ${snapshot.numChildren()} children, at ${process.env.PARENT_NODE_PATH}`);
  if (snapshot.numChildren() >= process.env.MAX_COUNT) {
    let childCount = 0;
    const updates = {};
    snapshot.forEach((child) => {
      if (++childCount <= snapshot.numChildren() - process.env.MAX_COUNT) {
        updates[child.key] = null;
      }
    });
    // Update the parent. This effectively removes the extra children.
    return parentRef.update(updates);
  }
  return null;
});
