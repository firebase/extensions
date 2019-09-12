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

import { Planner } from "../src/planner";

@suite
class PlannerTest extends Planner {
  @test "can handle empty shards"() {
    const plans = PlannerTest.planAggregations(
      "/exp/cnt/_counter_shards_/\t\t\t\t0",
      []
    );
    expect(plans).deep.equals([]);
  }

  @test "can aggregate one shard"() {
    const plans = PlannerTest.planAggregations(
      "/exp/cnt/__counter_shards_/\t\t\t\t0",
      [snap("/exp/cnt/__counter_shards__/00ec08a7")]
    );
    expect(plans).deep.equals([
      {
        aggregate: "/exp/cnt",
        isPartial: false,
        partials: [],
        shards: [snap("/exp/cnt/__counter_shards__/00ec08a7")],
      },
    ]);
  }

  @test "aggregates shards into partials"() {
    let plans = PlannerTest.planAggregations(
      "/exp/cnt/__counter_shards__/22222222",
      [
        snap("/exp/cnt/__counter_shards__/22222222"),
        snap("/exp/cnt/__counter_shards__/33333333"),
        snap("/exp/cnt/__counter_shards__/44444444"),
      ]
    );
    expect(plans).deep.equals([
      {
        aggregate: "/exp/cnt/__counter_shards__/\t\t\t\t2",
        isPartial: true,
        partials: [],
        shards: [snap("/exp/cnt/__counter_shards__/22222222")],
      },
      {
        aggregate: "/exp/cnt/__counter_shards__/\t\t\t\t3",
        isPartial: true,
        partials: [],
        shards: [snap("/exp/cnt/__counter_shards__/33333333")],
      },
      {
        aggregate: "/exp/cnt/__counter_shards__/\t\t\t\t4",
        isPartial: true,
        partials: [],
        shards: [snap("/exp/cnt/__counter_shards__/44444444")],
      },
    ]);

    plans = PlannerTest.planAggregations(
      "/exp/cnt/__counter_shards__/00000000",
      [
        snap("/exp/cnt/__counter_shards__/00ec08a7"),
        snap("/exp/cnt/__counter_shards__/01234567"),
      ]
    );
    expect(plans).deep.equals([
      {
        aggregate: "/exp/cnt/__counter_shards__/\t\t\t00",
        isPartial: true,
        partials: [],
        shards: [snap("/exp/cnt/__counter_shards__/00ec08a7")],
      },
      {
        aggregate: "/exp/cnt/__counter_shards__/\t\t\t01",
        isPartial: true,
        partials: [],
        shards: [snap("/exp/cnt/__counter_shards__/01234567")],
      },
    ]);

    plans = PlannerTest.planAggregations(
      "/exp/cnt/__counter_shards__/01234567",
      [
        snap("/exp/cnt/__counter_shards__/012fffff"),
        snap("/exp/cnt/__counter_shards__/013fffff"),
      ]
    );
    expect(plans).deep.equals([
      {
        aggregate: "/exp/cnt/__counter_shards__/\t\t012",
        isPartial: true,
        partials: [],
        shards: [snap("/exp/cnt/__counter_shards__/012fffff")],
      },
      {
        aggregate: "/exp/cnt/__counter_shards__/\t\t013",
        isPartial: true,
        partials: [],
        shards: [snap("/exp/cnt/__counter_shards__/013fffff")],
      },
    ]);
  }

  @test "aggregates shards into counter"() {
    const plans = PlannerTest.planAggregations(
      "/exp/cnt/__counter_shards__/\t\t\t\t0",
      [
        snap("/exp/cnt/__counter_shards__/00ec08a7"),
        snap("/exp/cnt/__counter_shards__/01234567"),
      ]
    );
    expect(plans).deep.equals([
      {
        aggregate: "/exp/cnt",
        isPartial: false,
        partials: [],
        shards: [
          snap("/exp/cnt/__counter_shards__/00ec08a7"),
          snap("/exp/cnt/__counter_shards__/01234567"),
        ],
      },
    ]);
  }

  @test "does not aggregate partials into themselves"() {
    const plans = PlannerTest.planAggregations(
      "/exp/cnt/__counter_shards__/\t\t012",
      [
        snap("/exp/cnt/__counter_shards__/\t\t014"),
        snap("/exp/cnt/__counter_shards__/\t\t015"),
      ]
    );
    expect(plans).deep.equals([
      {
        aggregate: "/exp/cnt/__counter_shards__/\t\t\t01",
        isPartial: true,
        partials: [
          snap("/exp/cnt/__counter_shards__/\t\t014"),
          snap("/exp/cnt/__counter_shards__/\t\t015"),
        ],
        shards: [],
      },
    ]);
  }

  @test "can aggregate many counters"() {
    const plans = PlannerTest.planAggregations(
      "/exp/cnt1/__counter_shards__/\0",
      [
        snap("/exp/cnt1/__counter_shards__/00ec08a7"),
        snap("/exp/cnt2/__counter_shards__/00ec08a7"),
        snap("/exp/cnt2/__counter_shards__/00ec08a8"),
      ]
    );
    expect(plans).deep.equals([
      {
        aggregate: "/exp/cnt1",
        isPartial: false,
        partials: [],
        shards: [snap("/exp/cnt1/__counter_shards__/00ec08a7")],
      },
      {
        aggregate: "/exp/cnt2",
        isPartial: false,
        partials: [],
        shards: [
          snap("/exp/cnt2/__counter_shards__/00ec08a7"),
          snap("/exp/cnt2/__counter_shards__/00ec08a8"),
        ],
      },
    ]);
  }
  @test "can aggregate partials and shards"() {
    const plans = PlannerTest.planAggregations(
      "/exp/cnt/__counter_shards__/\t\t000",
      [
        snap("/exp/cnt/__counter_shards__/\t\t000"),
        snap("/exp/cnt/__counter_shards__/00ec08a7"),
        snap("/exp/cnt/__counter_shards__/00ec08a8"),
        snap("/exp/cnt/__counter_shards__/00ec08a9"),
      ]
    );
    expect(plans).deep.equals([
      {
        aggregate: "/exp/cnt",
        isPartial: false,
        partials: [snap("/exp/cnt/__counter_shards__/\t\t000")],
        shards: [
          snap("/exp/cnt/__counter_shards__/00ec08a7"),
          snap("/exp/cnt/__counter_shards__/00ec08a8"),
          snap("/exp/cnt/__counter_shards__/00ec08a9"),
        ],
      },
    ]);
  }
}

function snap(path): any {
  return {
    ref: {
      path: path,
    },
  };
}
