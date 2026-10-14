/**
 * Copyright 2026 Google LLC
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

import { describe, expect, test, vi } from "vitest";
import {
  containsManyUpdates,
  isUpdatedFrequently,
  queryRange,
} from "../src/common";

function snap(
  data: Record<string, any> | undefined,
  updateTimeSeconds = 0
): any {
  return {
    exists: data !== undefined,
    data: () => data,
    updateTime: { seconds: updateTimeSeconds },
  };
}

describe("isUpdatedFrequently", () => {
  test("is false for missing shards", () => {
    expect(isUpdatedFrequently(snap(undefined))).toBe(false);
  });

  test("is true when the shard was written in the last 30 seconds", () => {
    expect(
      isUpdatedFrequently(snap({}, Math.floor(Date.now() / 1000) - 5))
    ).toBe(true);
  });

  test("is false once the shard has gone quiet for 30 seconds", () => {
    expect(
      isUpdatedFrequently(snap({}, Math.floor(Date.now() / 1000) - 31))
    ).toBe(false);
  });
});

describe("containsManyUpdates", () => {
  test("is false for missing partials", () => {
    expect(containsManyUpdates(snap(undefined))).toBe(false);
  });

  test("is false for documents without an _updates_ array", () => {
    expect(containsManyUpdates(snap({ counter: 1 }))).toBe(false);
  });

  test("is false while the partial holds 10 or fewer updates", () => {
    const updates = Array.from({ length: 10 }, () => ({ _data_: {} }));
    expect(containsManyUpdates(snap({ _updates_: updates }))).toBe(false);
  });

  test("is true once the partial holds more than 10 updates", () => {
    const updates = Array.from({ length: 11 }, () => ({ _data_: {} }));
    expect(containsManyUpdates(snap({ _updates_: updates }))).toBe(true);
  });
});

describe("queryRange", () => {
  function fakeDb() {
    const query: any = {
      startAt: vi.fn(() => query),
      endBefore: vi.fn(() => query),
      limit: vi.fn(() => query),
    };
    const orderBy = vi.fn(() => query);
    const collectionGroup = vi.fn(() => ({ orderBy }));
    return { db: { collectionGroup } as any, collectionGroup, orderBy, query };
  }

  test("orders a collection group query by document name", () => {
    const { db, collectionGroup, orderBy } = fakeDb();

    queryRange(db, "_counter_shards_", "", "", 100);

    expect(collectionGroup).toHaveBeenCalledWith("_counter_shards_");
    expect(orderBy).toHaveBeenCalledWith("__name__");
  });

  test("omits open-ended range bounds", () => {
    const { db, query } = fakeDb();

    queryRange(db, "_counter_shards_", "", "", 100);

    expect(query.startAt).not.toHaveBeenCalled();
    expect(query.endBefore).not.toHaveBeenCalled();
    expect(query.limit).toHaveBeenCalledWith(100);
  });

  test("applies both bounds of a slice", () => {
    const { db, query } = fakeDb();

    queryRange(
      db,
      "_counter_shards_",
      "a/b/_counter_shards_/0",
      "a/b/_counter_shards_/8",
      499
    );

    expect(query.startAt).toHaveBeenCalledWith("a/b/_counter_shards_/0");
    expect(query.endBefore).toHaveBeenCalledWith("a/b/_counter_shards_/8");
    expect(query.limit).toHaveBeenCalledWith(499);
  });
});
