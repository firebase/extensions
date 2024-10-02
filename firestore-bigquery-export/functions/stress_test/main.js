const { Worker } = require("worker_threads");
const { performance } = require("perf_hooks");
const path = require("path");

const totalDocs = 10000000; // Total number of documents to write
const maxThreads = 20; // Maximum number of worker threads
const batchSize = 500; // Documents per batch
const rampUpDelay = 2000; // 5 seconds delay between ramp-ups
const rampUps = 20; // Number of ramp-ups (planned)

const docsPerRampUp = Math.ceil(totalDocs / rampUps); // Documents per ramp-up

// Start measuring total execution time
const totalStartTime = performance.now();

const workerJsPath = path.resolve(__dirname, "worker.js");

// Function to spawn worker threads for a specific ramp-up
const spawnWorkers = async (activeThreads, startDoc, docsPerRampUp) => {
  console.log(`Spawning ${activeThreads} worker(s)...`);
  let promises = [];
  const docsPerThread = Math.ceil(docsPerRampUp / activeThreads);

  for (let i = 0; i < activeThreads; i++) {
    const docsForThisThread = Math.min(docsPerThread, docsPerRampUp);
    const start = startDoc + i * docsPerThread;
    const end = Math.min(start + docsForThisThread, startDoc + docsPerRampUp);

    promises.push(
      new Promise((resolve, reject) => {
        const worker = new Worker(workerJsPath, {
          workerData: {
            start,
            end,
            batchSize,
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

// Function to execute ramp-ups
const executeRampUps = async () => {
  let activeThreads = 1;
  let startDoc = 0;

  for (let i = 0; i < rampUps; i++) {
    await spawnWorkers(activeThreads, startDoc, docsPerRampUp);
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

// Run the ramp-ups
executeRampUps()
  .then(() => {
    const totalEndTime = performance.now();
    const totalDuration = (totalEndTime - totalStartTime) / 1000; // Convert to seconds
    console.log(
      `Successfully written ${totalDocs} documents to the collection in ${totalDuration.toFixed(
        2
      )} seconds.`
    );
  })
  .catch((error) => {
    console.error("Error in worker threads: ", error);
  });
