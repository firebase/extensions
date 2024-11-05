// count.js

const admin = require("firebase-admin");
const winston = require("winston");

// Load configuration from environment variables or use defaults
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
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

// Function to query Firestore for the total document count using count() aggregation
const getCollectionCount = async () => {
  try {
    const collectionRef = db.collection(COLLECTION_PATH);
    const snapshot = await collectionRef.count().get(); // Use the count aggregation query
    const count = snapshot.data().count;
    logger.info(`Collection "${COLLECTION_PATH}" has ${count} documents.`);
  } catch (error) {
    logger.error(`Error counting documents: ${error.message}`);
  }
};

// Start the count
getCollectionCount();
