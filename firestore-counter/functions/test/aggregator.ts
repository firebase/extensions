/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect } from "chai";
import { suite, test } from "mocha-typescript";
import { firestore } from "firebase-admin";

import { Aggregator, NumericUpdate } from "../src/aggregator";

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

    const aggr = new Aggregator(() => "0000");
    const counterUpdate = aggr.aggregate(counter, partials, shards);
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

    const partialUpdate = aggr.aggregate(null, partials, shards);
    expect(partialUpdate).deep.equal({
      _updates_: firestore.FieldValue.arrayUnion({
        _id_: "0000",
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

  @test "can subtract partial"() {
    const p = partial([
      { foo: 4 },
      { a: { b: { c: 10 } } },
      { a: { b: { c: 5 } } },
    ]);
    const aggr = new Aggregator(() => "0000");
    expect(aggr.subtractPartial(p)).to.deep.equal({
      _updates_: firestore.FieldValue.arrayUnion({
        _id_: "0000",
        _data_: {
          foo: -4,
          a: {
            b: {
              c: -15,
            },
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
class NumericUpdateTest extends NumericUpdate {
  @test "can merge from other object"() {
    const update = new NumericUpdateTest();

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

    expect(update.toPartialUpdate(() => "0000")).deep.equal({
      _updates_: firestore.FieldValue.arrayUnion({
        _id_: "0000",
        _data_: {
          a: { aa: 1, ab: 2 },
          b: { ba: 1 },
          c: 3,
        },
      }),
    });
  }

  @test "can verify noop updates"() {
    const update = new NumericUpdateTest();
    expect(update.isNoop()).true;
    update.mergeFrom({ a: 0 });
    expect(update.isNoop()).true;
    update.mergeFrom({ b: { c: 0 } });
    expect(update.isNoop()).true;
    update.mergeFrom({ d: 3 });
    expect(update.isNoop()).false;
    update.subtractFrom({ d: 3 });
    expect(update.isNoop()).true;
    update.mergeFrom({ stats: { cnt: 2 } });
    expect(update.isNoop()).false;
    update.subtractFrom({ stats: { cnt: 2 } });
    expect(update.isNoop()).true;
  }
}
