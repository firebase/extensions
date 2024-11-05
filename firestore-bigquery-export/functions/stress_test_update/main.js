// main.js

const { Worker } = require("worker_threads");
const path = require("path");
const os = require("os");
const admin = require("firebase-admin");
const winston = require("winston");

// Load configuration from environment variables or use defaults
const TOTAL_DOCS = parseInt(process.env.TOTAL_DOCS) || 1000000;
const MAX_THREADS = parseInt(process.env.MAX_THREADS) || os.cpus().length;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 500;
const TARGET_RATE = parseInt(process.env.TARGET_RATE) || 500; // Total documents per second
const COLLECTION_PATH =
  process.env.COLLECTION_PATH || "subcollection/to/export";

// Initialize Firebase Admin SDK
admin.initializeApp({
  projectId: "firestore-bigquery-testing",
});

// Set up logging with Winston
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "firestore-update-main" },
  transports: [new winston.transports.Console()],
});

const workerJsPath = path.resolve(__dirname, "worker.js");

// Main function to execute the updates
const main = async () => {
  try {
    logger.info("Starting update process...");

    // Prepare worker threads
    const workers = [];
    const perWorkerDocs = Math.ceil(TOTAL_DOCS / MAX_THREADS);
    const perWorkerTargetRate = Math.ceil(TARGET_RATE / MAX_THREADS);

    for (let i = 0; i < MAX_THREADS; i++) {
      const worker = new Worker(workerJsPath, {
        workerData: {
          collectionPath: COLLECTION_PATH,
          batchSize: BATCH_SIZE,
          targetRate: perWorkerTargetRate,
          totalDocsToUpdate: perWorkerDocs,
          workerId: i,
          totalWorkers: MAX_THREADS,
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

    logger.info("Update process completed.");
  } catch (error) {
    logger.error(`Error during execution: ${error.message}`);
  }
};

// Start the main function
main();
