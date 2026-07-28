import { describe, expect, test } from "vitest";

import { errorFromAny, getTranscriptionsByChannel } from "../src/util";

describe("errorFromAny", () => {
  test("returns the same Error instance", () => {
    const err = new Error("boom");
    expect(errorFromAny(err)).toBe(err);
  });

  test("wraps a non-error value", () => {
    const wrapped = errorFromAny("oops");
    expect(wrapped.name).toBe("Thrown non-error object");
    expect(wrapped.message).toBe("oops");
  });
});

describe("getTranscriptionsByChannel", () => {
  test("groups transcripts by channel tag", () => {
    const result = getTranscriptionsByChannel([
      { channelTag: 1, alternatives: [{ transcript: "hello" }] },
      { channelTag: 2, alternatives: [{ transcript: "world" }] },
      { channelTag: 1, alternatives: [{ transcript: "again" }] },
    ]);

    expect(result).toEqual({ 1: ["hello", "again"], 2: ["world"] });
  });

  test("returns null when a result lacks a channel tag", () => {
    const result = getTranscriptionsByChannel([
      { alternatives: [{ transcript: "hello" }] },
    ]);

    expect(result).toBeNull();
  });

  test("returns null (does not throw) when alternatives is an empty array", () => {
    expect(() =>
      getTranscriptionsByChannel([{ channelTag: 1, alternatives: [] }])
    ).not.toThrow();

    expect(
      getTranscriptionsByChannel([{ channelTag: 1, alternatives: [] }])
    ).toBeNull();
  });
});
