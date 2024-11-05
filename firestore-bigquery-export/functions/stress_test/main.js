// main.js

const { Worker } = require("worker_threads");
const path = require("path");
const os = require("os");
const admin = require("firebase-admin");
const winston = require("winston");
const fs = require("fs");

// Load configuration from environment variables or use defaults
const TOTAL_DOCS = parseInt(process.env.TOTAL_DOCS) || 1000000;
const MAX_THREADS = parseInt(process.env.MAX_THREADS) || os.cpus().length;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 500;
const TARGET_RATE = parseInt(process.env.TARGET_RATE) || 500; // Total documents per second
const COLLECTION_PATH =
  process.env.COLLECTION_PATH || "subcollection/to/export";

admin.initializeApp({
  projectId: "firestore-bigquery-testing",
});

// Get a reference to the Firestore service
const db = admin.firestore();

// Set up logging with Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "firestore-stress-test" },
  transports: [new winston.transports.Console()],
});

const workerJsPath = path.resolve(__dirname, "worker.js");

// Function to query Firestore for the total document count using count() aggregation
const getCollectionCount = async () => {
  const collectionRef = db.collection(COLLECTION_PATH);
  const snapshot = await collectionRef.count().get();
  const count = snapshot.data().count;
  logger.info(`Collection ${COLLECTION_PATH} has ${count} documents.`);
  return count;
};

// Main function to execute the stress test
const main = async () => {
  try {
    logger.info("Starting stress test...");

    // Count documents before writing
    const beforeCount = await getCollectionCount();

    // Prepare worker threads
    const workers = [];
    const docsPerWorker = Math.ceil(TOTAL_DOCS / MAX_THREADS);
    const perWorkerTargetRate = Math.ceil(TARGET_RATE / MAX_THREADS);

    for (let i = 0; i < MAX_THREADS; i++) {
      const startDoc = i * docsPerWorker;
      const endDoc = Math.min(startDoc + docsPerWorker, TOTAL_DOCS);

      const worker = new Worker(workerJsPath, {
        workerData: {
          collectionPath: COLLECTION_PATH,
          batchSize: BATCH_SIZE,
          targetRate: perWorkerTargetRate,
          startDoc,
          endDoc,
        },
      });

      worker.on("message", (message) => {
        logger.info(`Worker ${i + 1}: ${message}`);
      });

      worker.on("error", (err) => {
        logger.error(`Worker ${i + 1} error: ${err}`);
      });

      worker.on("exit", (code) => {
        if (code !== 0) {
          logger.error(`Worker ${i + 1} stopped with exit code ${code}`);
        } else {
          logger.info(`Worker ${i + 1} completed.`);
        }
      });

      workers.push(worker);
    }

    // Wait for all workers to finish
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise((resolve, reject) => {
            worker.on("exit", (code) => {
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`Worker stopped with exit code ${code}`));
              }
            });
          })
      )
    );

    // Count documents after writing
    const afterCount = await getCollectionCount();

    // Calculate and log the difference
    const totalDocsWritten = afterCount - beforeCount;
    logger.info(`Total documents written: ${totalDocsWritten}`);

    logger.info("Stress test completed.");
  } catch (error) {
    logger.error(`Error during execution: ${error.message}`);
  }
};

// Start the main function
main();
