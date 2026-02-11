// Mock Timestamp class that mimics firebase-admin Timestamp
class MockTimestamp {
  private _date: Date;

  constructor(seconds: number, nanoseconds: number) {
    this._date = new Date(seconds * 1000 + nanoseconds / 1000000);
  }

  static fromDate(date: Date): MockTimestamp {
    return new MockTimestamp(Math.floor(date.getTime() / 1000), 0);
  }

  toDate(): Date {
    return this._date;
  }
}

// Mock firebase-admin/firestore module
jest.mock("firebase-admin/firestore", () => ({
  Timestamp: MockTimestamp,
}));

import { calculateExpireAt } from "../src/ttl";
import { Timestamp } from "firebase-admin/firestore";

describe("calculateExpireAt", () => {
  const baseDate = new Date("2024-01-15T12:00:00Z");

  test("calculates hour expiration correctly", () => {
    const baseTimestamp = Timestamp.fromDate(baseDate);
    const result = calculateExpireAt(baseTimestamp, "hour", 2);
    const expected = new Date("2024-01-15T14:00:00Z");
    expect(result.toDate()).toEqual(expected);
  });

  test("calculates day expiration correctly", () => {
    const baseTimestamp = Timestamp.fromDate(baseDate);
    const result = calculateExpireAt(baseTimestamp, "day", 3);
    const expected = new Date("2024-01-18T12:00:00Z");
    expect(result.toDate()).toEqual(expected);
  });

  test("calculates week expiration correctly", () => {
    const baseTimestamp = Timestamp.fromDate(baseDate);
    const result = calculateExpireAt(baseTimestamp, "week", 2);
    const expected = new Date("2024-01-29T12:00:00Z");
    expect(result.toDate()).toEqual(expected);
  });

  test("calculates month expiration correctly", () => {
    const baseTimestamp = Timestamp.fromDate(baseDate);
    const result = calculateExpireAt(baseTimestamp, "month", 1);
    const expected = new Date("2024-02-15T12:00:00Z");
    expect(result.toDate()).toEqual(expected);
  });

  test("calculates year expiration correctly", () => {
    const baseTimestamp = Timestamp.fromDate(baseDate);
    const result = calculateExpireAt(baseTimestamp, "year", 1);
    const expected = new Date("2025-01-15T12:00:00Z");
    expect(result.toDate()).toEqual(expected);
  });

  test("throws error for unknown TTLExpireType", () => {
    const baseTimestamp = Timestamp.fromDate(baseDate);
    expect(() => calculateExpireAt(baseTimestamp, "invalid", 1)).toThrow(
      "Unknown TTLExpireType: invalid"
    );
  });

  test("handles zero value", () => {
    const baseTimestamp = Timestamp.fromDate(baseDate);
    const result = calculateExpireAt(baseTimestamp, "day", 0);
    expect(result.toDate()).toEqual(baseDate);
  });

  test("handles large values", () => {
    const baseTimestamp = Timestamp.fromDate(baseDate);
    const result = calculateExpireAt(baseTimestamp, "day", 365);
    // 2024 is a leap year (366 days), so 365 days from Jan 15 is Jan 14 next year
    const expected = new Date("2025-01-14T12:00:00Z");
    expect(result.toDate()).toEqual(expected);
  });

  test("handles month boundary correctly", () => {
    // Jan 31 + 1 month - JavaScript Date overflows Feb
    const jan31 = Timestamp.fromDate(new Date("2024-01-31T12:00:00Z"));
    const result = calculateExpireAt(jan31, "month", 1);
    // For 2024 (leap year), Jan 31 + 1 month = March 2 (Feb has 29 days, 31-29=2)
    const resultDate = result.toDate();
    expect(resultDate.getMonth()).toBe(2); // March (0-indexed)
    expect(resultDate.getDate()).toBe(2);
  });
});
