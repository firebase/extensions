import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ShardedCounterWorker } from './worker';
import { ShardedCounterController } from './controller';

const app = admin.initializeApp();
app.firestore().settings({ timestampsInSnapshots: true });

export const shardedCounterWorker = functions
  .firestore.document(process.env.MODS_INTERNAL_COLLECTION +
    '/sharded_counter/workers/{workerId}')
  .onWrite(async (change, context) => {
    // stop worker if document got deleted
    if (!change.after.exists) return;

    const worker = new ShardedCounterWorker(change.after, process.env.COUNTER_SHARDS_COLLECTION);
    await worker.run();
  });

export const shardedCounterController = functions
  .https.onRequest(async (req, res) => {
    const metadocRef = app.firestore().collection(process.env.MODS_INTERNAL_COLLECTION)
      .doc('sharded_counter');
    const controller = new ShardedCounterController(
      metadocRef, process.env.COUNTER_SHARDS_COLLECTION, parseInt(process.env.MIN_WORKERS));
    await controller.run();
    res.status(200).send('OK');
  });
