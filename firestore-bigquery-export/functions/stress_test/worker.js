const { parentPort, workerData } = require("worker_threads");
const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const { performance } = require("perf_hooks");

// Initialize Firebase Admin SDK
admin.initializeApp({
  projectId: "vertex-testing-1efc3",
});

// Get a reference to the Firestore service
const db = admin.firestore();
const collectionName = "posts_2";

// Generate a random document
const generateRandomDocument = () => {
  return {
    id: uuidv4(),
    name: `Name_${Math.random().toString(36).substring(7)}`,
    age: Math.floor(Math.random() * 60) + 18, // Random age between 18 and 78
    email: `user_${Math.random().toString(36).substring(7)}@example.com`,
    isActive: Math.random() > 0.5, // Random boolean value
    createdAt: admin.firestore.Timestamp.now(),
  };
};

// Write a batch of documents to Firestore
const writeBatch = async (start, end, batchSize) => {
  let count = start;
  while (count < end) {
    const batchStartTime = performance.now();

    let batch = db.batch();
    for (let i = 0; i < batchSize && count < end; i++) {
      let docRef = db.collection(collectionName).doc();
      batch.set(docRef, generateRandomDocument());
      count++;
    }

    await batch.commit();

    const batchEndTime = performance.now();
    const batchDuration = (batchEndTime - batchStartTime) / 1000; // Convert to seconds
    parentPort.postMessage(
      `Batch of ${batchSize} documents written in ${batchDuration.toFixed(
        2
      )} seconds.`
    );
  }
};

// Start writing in batches
writeBatch(workerData.start, workerData.end, workerData.batchSize)
  .then(() => {
    parentPort.postMessage("Completed writing documents.");
  })
  .catch((error) => {
    parentPort.postMessage(`Error writing documents: ${error}`);
  });
