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

// Generate a large random document closer to 1MB
const generateRandomDocument = () => {
  // const largeString = "x".repeat(300000); // A string of 300,000 characters (~300 KB)
  // const largeArray = new Array(5000).fill().map((_, i) => ({
  //   index: i,
  //   value: `Value_${Math.random().toString(36).substring(7)}`,
  // }));

  return {
    id: uuidv4(),
    name: `Name_${Math.random().toString(36).substring(7)}`,
    age: Math.floor(Math.random() * 60) + 18, // Random age between 18 and 78
    email: `user_${Math.random().toString(36).substring(7)}@example.com`,
    isActive: Math.random() > 0.5, // Random boolean value
    createdAt: admin.firestore.Timestamp.now(),
    // largeString, // Large string field
    // largeArray, // Large array field
  };
};

// Delay function for rate control
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Write a batch of documents to a specific collection in Firestore
const writeBatch = async (
  start,
  end,
  batchSize,
  collectionPath,
  delayBetweenBatches
) => {
  let count = start;
  while (count < end) {
    const batchStartTime = performance.now();

    let batch = db.batch();
    const remainingDocs = end - count;
    const adjustedBatchSize = Math.min(batchSize, remainingDocs); // Adjust batch size if remaining docs < batchSize

    for (let i = 0; i < adjustedBatchSize && count < end; i++) {
      let docRef = db.collection(collectionPath).doc();
      batch.set(docRef, generateRandomDocument());
      count++;
    }

    await batch.commit();

    const batchEndTime = performance.now();
    const batchDuration = (batchEndTime - batchStartTime) / 1000; // Convert to seconds
    parentPort.postMessage(
      `Batch of ${adjustedBatchSize} documents written in ${batchDuration.toFixed(
        2
      )} seconds to ${collectionPath}.`
    );

    // Introduce delay between batches to meet target rate
    await delay(delayBetweenBatches);
  }
};

// Start writing in batches
writeBatch(
  workerData.start,
  workerData.end,
  workerData.batchSize,
  workerData.collectionPath,
  workerData.delayBetweenBatches // Pass the delay for rate control
)
  .then(() => {
    parentPort.postMessage("Completed writing documents.");
  })
  .catch((error) => {
    parentPort.postMessage(`Error writing documents: ${error}`);
  });
