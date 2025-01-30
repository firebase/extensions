import * as firebase from "firebase-admin";
import { cpus } from "os";
import { pool } from "workerpool";
import * as fs from "fs";
import * as logs from "./logs";
import { CliConfig } from "./types";

/**
 * Import data from a collection group in parallel using workers.
 */
export async function runMultiThread(config: CliConfig): Promise<number> {
  if (config.failedBatchOutput) {
    // delete JSON file if it exists
    if (fs.existsSync(config.failedBatchOutput)) {
      fs.unlink(config.failedBatchOutput, (err) => {
        if (err) {
          throw new Error(`Error deleting ${config.failedBatchOutput}: ${err}`);
        } else {
          console.log(`${config.failedBatchOutput} was deleted successfully.`);
        }
      });
    }
  }

  const maxWorkers = Math.ceil(cpus().length / 2);
  const workerPool = pool(__dirname + "/worker.js", {
    maxWorkers,
    forkOpts: {
      env: {
        PROJECT_ID: config.projectId,
        GOOGLE_CLOUD_PROJECT: config.projectId,
        GCLOUD_PROJECT: config.projectId,
        FAILED_BATCH_OUTPUT: config.failedBatchOutput || "",
        ...process.env,
      },
    },
  });

  const query = firebase
    .firestore()
    .collectionGroup(
      config.sourceCollectionPath.split("/")[
        config.sourceCollectionPath.split("/").length - 1
      ]
    );

  const partitionsList = query.getPartitions(config.batchSize);

  let total = 0;
  let partitions = 0;

  if (config.failedBatchOutput) {
    // Initialize failed batch JSON file
    fs.writeFileSync(config.failedBatchOutput, "[\n", "utf8");
  }

  while (true) {
    const inProgressTasks =
      workerPool.stats().activeTasks + workerPool.stats().pendingTasks;
    if (inProgressTasks >= maxWorkers) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      continue;
    }

    // @ts-ignore, iterator not typed correctly.
    const { value: partition, done } = await partitionsList.next();
    if (done || !partition) {
      break;
    }

    partitions++;

    const query = partition.toQuery();

    const serializedQuery = {
      startAt: query._queryOptions.startAt,
      endAt: query._queryOptions.endAt,
      limit: query._queryOptions.limit,
      offset: query._queryOptions.offset,
    };

    workerPool
      .exec("processDocuments", [serializedQuery, config])
      .then((count) => {
        total += count;
        console.log(`${total} documents processed`);
      })
      .catch((error) => {
        console.error(
          "An error has occurred on the following documents, please re-run or insert the following query documents manually...",
          JSON.stringify(serializedQuery)
        );
        console.error(error);
      });
  }

  while (workerPool.stats().activeTasks + workerPool.stats().pendingTasks > 0) {
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  await workerPool.terminate();

  if (config.failedBatchOutput) {
    // Read the file and remove the trailing comma
    const failedBatches = fs.readFileSync(config.failedBatchOutput, "utf8");
    const fixedJson = failedBatches.replace(/,\s*$/, ""); // Remove last comma
    fs.writeFileSync(config.failedBatchOutput, fixedJson + "\n]", "utf8");

    console.log(`Failed batches written to ${config.failedBatchOutput}`);
  }

  logs.finishedImportingParallel(config, total, partitions);

  return Promise.resolve(total);
}
