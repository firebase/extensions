/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { expect } from 'chai';
import { suite, test, timeout } from "mocha-typescript";
import { ShardedCounterWorker } from '../src/worker';
import { initializeApp, credential, apps } from "firebase-admin";

let serviceAccount = require('../../test-project-key.json');

const app = initializeApp({
  credential: credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});
const db = app.firestore();
db.settings({ timestampsInSnapshots: true });

@suite class WorkerTest {
  @test @timeout(10000) async 'can run single aggregation'() {
    let metadocRef = db.doc('testing/worker');
    let shardsRef = db.collection('testing/counter/_counter_shards_');
    let counterRef = db.doc('testing/counter');
    await counterRef.set({ stats: { cnt: 2 }, data: 'hello world' });
    await metadocRef.set({
      slice: {
        start: 'testing/counter/_counter_shards_/\t',
        end: 'testing/counter/_counter_shards_/Z'
      },
      timestamp: Date.now()
    });
    await shardsRef.doc('\t\t012').set({ '_updates_': [{ '_data_': { stats: { cnt: 2 } } }] });
    await shardsRef.doc('012345678').set({ stats: { cnt: 1 } });
    await shardsRef.doc('123456789').set({ stats: { cnt: 2 } });
    await shardsRef.doc('23456789a').set({ stats: { cnt: 3 } });
    await shardsRef.doc('3456789ab').set({ stats: { new: 5 } });
    let metadoc = await metadocRef.get();
    console.log('Single run: ' + JSON.stringify(metadoc.data()));

    const worker = new ShardedCounterWorker(metadoc, '_counter_shards_', true);
    await worker.run();

    let counter = await db.doc('testing/counter').get();
    expect(counter.data()).deep.equal({ stats: { cnt: 10, new: 5 }, data: 'hello world' });
    metadoc = await metadocRef.get();
    console.log('Single run done: ' + JSON.stringify(metadoc.data()));
  }
}
