// worker.js

const { parentPort, workerData } = require("worker_threads");
const admin = require("firebase-admin");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const { v4: uuidv4 } = require("uuid");
const winston = require("winston");

// Unpack workerData
const { collectionPath, batchSize, targetRate, startDoc, endDoc } = workerData;

admin.initializeApp({
  projectId: "firestore-bigquery-testing",
});
// Get a reference to the Firestore service
const db = admin.firestore();

// Set up logging with Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "firestore-stress-test-worker" },
  transports: [new winston.transports.Console()],
});

// Create a rate limiter for this worker
const rateLimiter = new RateLimiterMemory({
  points: targetRate, // Number of points per duration
  duration: 1, // Per second
});

// Function to generate a random document
const generateRandomDocument = () => {
  const now = Date.now();
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;
  const randomOffset = Math.floor(Math.random() * threeDaysInMs);
  const randomTimestamp = new Date(now - randomOffset);

  return {
    id: uuidv4(),
    name: `Name_${Math.random().toString(36).substring(7)}`,
    age: Math.floor(Math.random() * 60) + 18,
    email: `user_${Math.random().toString(36).substring(7)}@example.com`,
    isActive: Math.random() > 0.5,
    createdAt: admin.firestore.Timestamp.now(),
    custom_timestamp: admin.firestore.Timestamp.fromDate(randomTimestamp),
  };
};

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

// Function to write documents in batches with rate limiting
const writeDocuments = async () => {
  let count = startDoc;
  const totalDocsToWrite = endDoc - startDoc;
  let docsWritten = 0;

  while (docsWritten < totalDocsToWrite) {
    const batch = db.batch();
    const remainingDocs = totalDocsToWrite - docsWritten;
    const docsInThisBatch = Math.min(batchSize, remainingDocs);

    for (let i = 0; i < docsInThisBatch; i++) {
      const docRef = db.collection(collectionPath).doc();
      const docData = generateRandomDocument();
      batch.set(docRef, docData);
    }

    // Consume points from the rate limiter
    await rateLimiter.consume(docsInThisBatch);

    const batchStartTime = process.hrtime.bigint();

    await commitBatchWithRetry(batch);

    const batchEndTime = process.hrtime.bigint();
    const batchDurationMs = Number(batchEndTime - batchStartTime) / 1e6;

    docsWritten += docsInThisBatch;

    parentPort.postMessage(
      `Batch of ${docsInThisBatch} documents written in ${batchDurationMs.toFixed(
        2
      )} ms.`
    );
  }
};

// Start writing documents
writeDocuments()
  .then(() => {
    parentPort.postMessage("Worker completed writing documents.");
    process.exit(0);
  })
  .catch((error) => {
    parentPort.postMessage(`Error writing documents: ${error.message}`);
    process.exit(1);
  });
