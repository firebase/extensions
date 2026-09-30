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

const admin = require("firebase-admin");

// Initialize Firebase Admin with your credentials
// Make sure you've already set up your Firebase Admin SDK
admin.initializeApp({
  projectId: "vertex-testing-1efc3",
});

const firestore = admin.firestore();

async function countDocuments(collectionPath) {
  try {
    const collectionRef = firestore.collection(collectionPath);

    // Perform an aggregate query to count the documents
    const snapshot = await collectionRef.count().get();

    // Access the count from the snapshot
    const docCount = snapshot.data().count;

    console.log(
      `Number of documents in collection '${collectionPath}':`,
      docCount
    );
    return docCount;
  } catch (error) {
    console.error("Error counting documents:", error);
    throw error;
  }
}

// Call the function and pass the collection path
countDocuments("posts_2");
