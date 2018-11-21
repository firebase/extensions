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
        await counterRef.set({cnt: 2});
        await metadocRef.set({
            slice: {
                start: 'testing/counter/_counter_shards_/\t',
                end: 'testing/counter/_counter_shards_/Z'
            },
            timestamp: Date.now()
        });
        await shardsRef.doc('\t\t012').set({'_updates_': [{cnt: 2}]});
        await shardsRef.doc('012345678').set({cnt: 1});
        await shardsRef.doc('123456789').set({cnt: 2});
        await shardsRef.doc('23456789a').set({cnt: 3});
        let metadoc = await metadocRef.get();
        console.log('Single run: ' + JSON.stringify(metadoc.data()));

        const worker = new ShardedCounterWorker(metadoc, '_counter_shards_', true);
        await worker.run();

        let counter = await db.doc('testing/counter').get();
        expect(counter.data()).deep.equal({cnt: 10});
        metadoc = await metadocRef.get();
        console.log('Single run done: ' + JSON.stringify(metadoc.data()));
    }
}