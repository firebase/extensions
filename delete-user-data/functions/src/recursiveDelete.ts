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

import * as admin from "firebase-admin";

const MAX_RETRY_ATTEMPTS = 3;

export const recursiveDelete = async (
  path: string,
  db: admin.firestore.Firestore
) => {
  // Recursively delete a reference and log the references of failures.
  const bulkWriter = db.bulkWriter();

  bulkWriter.onWriteError((error) => {
    if (error.failedAttempts < MAX_RETRY_ATTEMPTS) {
      return true;
    } else {
      console.warn("Failed to delete document: ", error.documentRef.path);
      return false;
    }
  });

  const isDocument = path.split("/").length % 2 === 0;

  const reference = isDocument ? db.doc(path) : db.collection(path);

  await db.recursiveDelete(reference, bulkWriter);
};
