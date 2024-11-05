// worker.js

const { parentPort, workerData } = require("worker_threads");
const admin = require("firebase-admin");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const winston = require("winston");

// Unpack workerData
const {
  collectionPath,
  batchSize,
  targetRate,
  totalDocsToUpdate,
  workerId,
  totalWorkers,
} = workerData;

// Initialize Firebase Admin SDK
admin.initializeApp({
  projectId: "firestore-bigquery-testing",
});

// Get a reference to the Firestore service
const db = admin.firestore();

// Set up logging with Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "firestore-update-worker" },
  transports: [new winston.transports.Console()],
});

// Create a rate limiter for this worker
const rateLimiter = new RateLimiterMemory({
  points: targetRate, // Number of points per duration
  duration: 1, // Per second
});

// Function to commit a batch with retry logic
const MAX_RETRIES = 5;

const commitBatchWithRetry = async (batch, retries = 0) => {
  try {
    await batch.commit();
  } catch (error) {
    if (retries < MAX_RETRIES) {
      const delay = Math.pow(2, retries) * 100; // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
      await commitBatchWithRetry(batch, retries + 1);
    } else {
      throw error;
    }
  }
};

// Function to update documents in batches with rate limiting
const updateDocuments = async () => {
  let docsProcessed = 0;
  let lastDoc = null;

  while (docsProcessed < totalDocsToUpdate) {
    let query = db
      .collection(collectionPath)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(batchSize)
      .select(); // Retrieve only document IDs

    if (lastDoc) {
      query = query.startAfter(lastDoc.id);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const docId = doc.id;

      // Simple hash function to distribute documents among workers
      const hash = hashString(docId);
      if (hash % totalWorkers !== workerId) {
        continue; // Skip documents not assigned to this worker
      }

      const docRef = doc.ref;
      batch.update(docRef, {
        a: JSON.stringify(Math.floor(Math.random() * 10000)),
        b: JSON.stringify(Math.floor(Math.random() * 10000)),
        c: JSON.stringify(Math.floor(Math.random() * 10000)),
        d: JSON.stringify(Math.floor(Math.random() * 10000)),
        e: JSON.stringify(Math.floor(Math.random() * 10000)),
      });
      batchCount++;
      docsProcessed++;

      if (docsProcessed >= totalDocsToUpdate || batchCount >= batchSize) {
        break;
      }
    }

    if (batchCount === 0) {
      // No documents to process in this batch
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      continue;
    }

    // Consume points from the rate limiter
    await rateLimiter.consume(batchCount);

    const batchStartTime = process.hrtime.bigint();

    await commitBatchWithRetry(batch);

    const batchEndTime = process.hrtime.bigint();
    const batchDurationMs = Number(batchEndTime - batchStartTime) / 1e6;

    parentPort.postMessage(
      `Batch of ${batchCount} documents updated in ${batchDurationMs.toFixed(
        2
      )} ms. Total processed: ${docsProcessed}/${totalDocsToUpdate}`
    );

    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (docsProcessed >= totalDocsToUpdate) {
      break;
    }
  }
};

// Simple hash function for strings
function hashString(str) {
  let hash = 0;
  if (str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Start updating documents
updateDocuments()
  .then(() => {
    parentPort.postMessage("Worker completed updating documents.");
    process.exit(0);
  })
  .catch((error) => {
    parentPort.postMessage(`Error updating documents: ${error.message}`);
    process.exit(1);
  });
