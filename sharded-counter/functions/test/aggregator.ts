import { expect } from 'chai';
import { suite, test } from "mocha-typescript";
import { firestore } from "firebase-admin";

import { Aggregator } from "../src/aggregator";


@suite class AggregatorTest extends Aggregator {
    @test 'can aggregate'() {
        const shards = [
            shard({visits: 2, likes: 1}),
            shard({visits: 1, stars: 1}),
            shard({stats: {loadTime: 500, renderTime: 10, count: 1}, likes: 1}),
            shard({stats: {loadTime: 1}})
        ];
        const partials = [
            partial([{'touches': 1, 'stats.count': 1}, {'stats.touches': 2}]),
            partial([{'stars': 1}])
        ];

        const counter: any = {
            get: () => { return undefined; }
        }

        const counterUpdate = AggregatorTest.aggregate(counter, partials, shards);
        expect(counterUpdate).deep.equal({
            visits: 3,
            likes: 2,
            stars: 2,
            touches: 1,
            'stats.loadTime': 501,
            'stats.renderTime': 10,
            'stats.count': 2,
            'stats.touches': 2
        });

        const partialUpdate = AggregatorTest.aggregate(null, partials, shards);
        expect(partialUpdate).deep.equal({
            '_updates_': firestore.FieldValue.arrayUnion({
                visits: 3,
                likes: 2,
                stars: 2,
                touches: 1,
                'stats.loadTime': 501,
                'stats.renderTime': 10,
                'stats.count': 2,
                'stats.touches': 2
            })
        });
    }
}

function shard(data: {[key: string]: any}): firestore.DocumentSnapshot {
    return <any> {
        data: () => { return data; },
        exists: true
    }
}

function partial(updates: {[key: string]: any}[]): firestore.DocumentSnapshot {
    return <any> {
        data: () => { return {
            '_updates_': updates
        }},
        exists: true
    }
}