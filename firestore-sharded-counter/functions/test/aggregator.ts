/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

import { expect } from "chai";
import { suite, test } from "mocha-typescript";
import { firestore } from "firebase-admin";

import { Aggregator, NumericUpdate } from "../src/aggregator";
import { FieldPath, FieldValue } from "@google-cloud/firestore";

@suite
class AggregatorTest extends Aggregator {
  @test "can aggregate"() {
    const shards = [
      shard({ visits: 2, likes: 1 }),
      shard({ visits: 1, stars: 1 }),
      shard({ stats: { loadTime: 500, renderTime: 10, count: 1 }, likes: 1 }),
      shard({ stats: { loadTime: 1 } }),
    ];
    const partials = [
      partial([{ touches: 1, stats: { count: 1, touches: 2 } }]),
      partial([{ stars: 1 }]),
    ];

    const counter: any = {
      data: () => {
        return {};
      },
    };

    const counterUpdate = AggregatorTest.aggregate(counter, partials, shards);
    expect(counterUpdate).deep.equal({
      visits: 3,
      likes: 2,
      stars: 2,
      touches: 1,
      stats: {
        loadTime: 501,
        renderTime: 10,
        count: 2,
        touches: 2,
      },
    });

    const partialUpdate = AggregatorTest.aggregate(null, partials, shards);
    expect(partialUpdate).deep.equal({
      _updates_: firestore.FieldValue.arrayUnion({
        _timestamp_: FieldValue.serverTimestamp(),
        _data_: {
          visits: 3,
          likes: 2,
          stars: 2,
          touches: 1,
          stats: {
            loadTime: 501,
            renderTime: 10,
            count: 2,
            touches: 2,
          },
        },
      }),
    });
  }
}

function shard(data: { [key: string]: any }): firestore.DocumentSnapshot {
  return <any>{
    data: () => {
      return data;
    },
    exists: true,
  };
}

function partial(
  updates: { [key: string]: any }[]
): firestore.DocumentSnapshot {
  return <any>{
    data: () => {
      return {
        _updates_: updates.map((data) => {
          return { _data_: data };
        }),
      };
    },
    exists: true,
  };
}

@suite
class NumericUpdateTest {
  @test "can merge from other object"() {
    const update = new NumericUpdate();

    update.mergeFrom({ a: 1 });
    expect(update.data).deep.equal({ a: 1 });

    update.mergeFrom({ b: 2 });
    expect(update.data).deep.equal({ a: 1, b: 2 });

    update.mergeFrom({ c: { d: 4 } });
    expect(update.data).deep.equal({ a: 1, b: 2, c: { d: 4 } });

    update.mergeFrom({ a: { b: 2 } });
    expect(update.data).deep.equal({ a: { b: 2 }, b: 2, c: { d: 4 } });

    update.mergeFrom({ c: 3 });
    expect(update.data).deep.equal({ a: { b: 2 }, b: 2, c: 3 });
  }

  @test "can export to counter update"() {
    const update = new NumericUpdate();

    update.mergeFrom({
      a: { aa: 1, ab: 2 },
      b: { ba: 1 },
      c: 3,
    });

    expect(update.toCounterUpdate({})).deep.equal({
      a: { aa: 1, ab: 2 },
      b: { ba: 1 },
      c: 3,
    });

    expect(update.toCounterUpdate({ c: 2, d: 4 })).deep.equal({
      a: { aa: 1, ab: 2 },
      b: { ba: 1 },
      c: 5,
    });
  }

  @test "can export to partial update"() {
    const update = new NumericUpdate();

    update.mergeFrom({
      a: { aa: 1, ab: 2 },
      b: { ba: 1 },
      c: 3,
    });

    expect(update.toPartialUpdate()).deep.equal({
      _updates_: FieldValue.arrayUnion({
        _timestamp_: FieldValue.serverTimestamp(),
        _data_: {
          a: { aa: 1, ab: 2 },
          b: { ba: 1 },
          c: 3,
        },
      }),
    });
  }
}
