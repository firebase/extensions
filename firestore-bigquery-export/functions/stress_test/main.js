const { Worker } = require("worker_threads");
const { performance } = require("perf_hooks");
const path = require("path");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp({
  projectId: "vertex-testing-1efc3",
});

// Get a reference to the Firestore service
const db = admin.firestore();

const totalDocs = 1000000; // Total number of documents to write
const maxThreads = 20; // Maximum number of worker threads
const batchSize = 500; // Documents per batch
const targetRate = 500; // Target docs per second
const rampUpDelay = 1000; // Delay between ramp-ups
const rampUps = 5; // Number of ramp-ups
const docsPerRampUp = Math.ceil(totalDocs / rampUps); // Documents per ramp-up

// Calculate the delay needed to meet the target rate (in milliseconds)
const delayBetweenBatches = Math.max(1000 / (targetRate / batchSize), 0); // Delay between batches in ms

// Hardcoded collection paths with the form: A/{aid}/B/{bid}/C/{cid}/D/{did}/E/{eid}/F/{fid}/G
const collectionPaths = [
  "A/aid1/B/bid1/C/cid1/D/did1/E/eid1/F/fid1/G",
  "A/aid2/B/bid2/C/cid2/D/did2/E/eid2/F/fid2/G",
  "A/aid3/B/bid3/C/cid3/D/did3/E/eid3/F/fid3/G",
  "A/aid4/B/bid4/C/cid4/D/did4/E/eid4/F/fid4/G",
  "A/aid5/B/bid5/C/cid5/D/did5/E/eid5/F/fid5/G",
];

// Start measuring total execution time
const totalStartTime = performance.now();

const workerJsPath = path.resolve(__dirname, "worker.js");

// Function to spawn worker threads for a specific ramp-up
const spawnWorkers = async (
  activeThreads,
  startDoc,
  docsPerRampUp,
  collectionPath
) => {
  console.log(
    `Spawning ${activeThreads} worker(s) for collection ${collectionPath}...`
  );
  let promises = [];
  const docsPerThread = Math.ceil(docsPerRampUp / activeThreads);

  for (let i = 0; i < activeThreads; i++) {
    const docsForThisThread = Math.min(docsPerThread, docsPerRampUp);
    const start = startDoc + i * docsForThisThread;
    const end = Math.min(start + docsForThisThread, startDoc + docsPerRampUp);

    promises.push(
      new Promise((resolve, reject) => {
        const worker = new Worker(workerJsPath, {
          workerData: {
            start,
            end,
            batchSize,
            collectionPath, // Pass the collection path to the worker
            delayBetweenBatches, // Pass the delay to the worker
          },
        });

        worker.on("message", (message) => {
          console.log(`Worker ${i + 1}: ${message}`);
        });

        worker.on("error", (err) => {
          console.error(`Worker ${i + 1} error: ${err}`);
          reject(err);
        });

        worker.on("exit", (code) => {
          if (code !== 0) {
            reject(new Error(`Worker ${i + 1} stopped with exit code ${code}`));
          } else {
            resolve();
          }
        });
      })
    );
  }

  try {
    await Promise.all(promises);
  } catch (error) {
    console.error("Error in worker threads: ", error);
    throw error;
  }
};

// Function to query Firestore for the total document count using count() aggregation
const getCollectionCounts = async () => {
  let counts = {};

  for (const collectionPath of collectionPaths) {
    const collectionRef = db.collection(collectionPath);
    const snapshot = await collectionRef.count().get(); // Use the count aggregation query
    const count = snapshot.data().count;
    counts[collectionPath] = count;
    console.log(`Collection ${collectionPath} has ${count} documents.`);
  }

  return counts;
};

// Function to calculate the difference between two count objects
const calculateCountDifference = (beforeCounts, afterCounts) => {
  let totalDifference = 0;

  for (const collectionPath in beforeCounts) {
    const beforeCount = beforeCounts[collectionPath] || 0;
    const afterCount = afterCounts[collectionPath] || 0;
    const difference = afterCount - beforeCount;
    console.log(`Collection ${collectionPath} difference: ${difference}`);
    totalDifference += difference;
  }

  return totalDifference;
};

// Function to execute ramp-ups
const executeRampUps = async () => {
  let activeThreads = 1;
  let startDoc = 0;

  for (let i = 0; i < rampUps; i++) {
    const collectionPath = collectionPaths[i % collectionPaths.length]; // Rotate through collections
    await spawnWorkers(activeThreads, startDoc, docsPerRampUp, collectionPath);
    startDoc += docsPerRampUp;

    if (activeThreads < maxThreads) {
      activeThreads++; // Increase the number of threads for next ramp-up
    }

    if (i < rampUps - 1) {
      console.log(
        `Ramping up to ${activeThreads} worker(s) in ${
          rampUpDelay / 1000
        } seconds...`
      );
      await new Promise((resolve) => setTimeout(resolve, rampUpDelay));
    }
  }
};

// Main execution flow
const main = async () => {
  try {
    // Count documents before writing
    console.log("Counting documents before the operation...");
    const beforeCounts = await getCollectionCounts();

    // Perform the writing operation
    await executeRampUps();

    // Count documents after writing
    console.log("Counting documents after the operation...");
    const afterCounts = await getCollectionCounts();

    // Calculate and log the difference
    const totalDocsWritten = calculateCountDifference(
      beforeCounts,
      afterCounts
    );
    console.log(`Total documents written: ${totalDocsWritten}`);

    const totalEndTime = performance.now();
    const totalDuration = (totalEndTime - totalStartTime) / 1000; // Convert to seconds
    console.log(
      `Successfully written ${totalDocsWritten} documents in ${totalDuration.toFixed(
        2
      )} seconds.`
    );
  } catch (error) {
    console.error("Error during execution: ", error);
  }
};

// Run the main function
main();
