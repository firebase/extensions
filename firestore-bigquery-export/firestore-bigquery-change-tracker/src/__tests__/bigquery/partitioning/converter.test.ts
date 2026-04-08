import * as admin from "firebase-admin";
import { PartitionValueConverter } from "../../../bigquery/partitioning/converter";

describe("PartitionValueConverter", () => {
  describe("convert with TIMESTAMP type", () => {
    const converter = new PartitionValueConverter("TIMESTAMP");

    test("converts Firebase Timestamp to BigQuery timestamp string", () => {
      const timestamp = admin.firestore.Timestamp.fromDate(
        new Date("2024-01-15T10:30:00Z")
      );
      const result = converter.convert(timestamp);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    test("converts timestamp-like object to BigQuery timestamp string", () => {
      const timestampLike = {
        _seconds: 1705315800,
        _nanoseconds: 0,
      };
      const result = converter.convert(timestampLike);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    test("converts native Date to BigQuery timestamp string", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const result = converter.convert(date);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    test("returns null for invalid Date", () => {
      const invalidDate = new Date("invalid");
      const result = converter.convert(invalidDate);
      expect(result).toBeNull();
    });

    test("returns null for number", () => {
      const result = converter.convert(1705315800);
      expect(result).toBeNull();
    });

    test("returns null for string", () => {
      const result = converter.convert("2024-01-15");
      expect(result).toBeNull();
    });

    test("returns null for null", () => {
      const result = converter.convert(null);
      expect(result).toBeNull();
    });

    test("returns null for undefined", () => {
      const result = converter.convert(undefined);
      expect(result).toBeNull();
    });

    test("returns null for object without _seconds/_nanoseconds", () => {
      const result = converter.convert({ foo: "bar" });
      expect(result).toBeNull();
    });

    test("returns null when _seconds is not a number", () => {
      const result = converter.convert({
        _seconds: "not a number",
        _nanoseconds: 0,
      });
      expect(result).toBeNull();
    });

    test("returns null when _nanoseconds is not a number", () => {
      const result = converter.convert({
        _seconds: 1705315800,
        _nanoseconds: "not a number",
      });
      expect(result).toBeNull();
    });
  });

  describe("convert with DATE type", () => {
    const converter = new PartitionValueConverter("DATE");

    test("converts Firebase Timestamp to BigQuery date string", () => {
      const timestamp = admin.firestore.Timestamp.fromDate(
        new Date("2024-01-15T10:30:00Z")
      );
      const result = converter.convert(timestamp);
      expect(result).toBe("2024-01-15");
    });

    test("converts timestamp-like object to BigQuery date string", () => {
      const timestampLike = {
        _seconds: 1705315800,
        _nanoseconds: 0,
      };
      const result = converter.convert(timestampLike);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("converts native Date to BigQuery date string", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const result = converter.convert(date);
      expect(result).toBe("2024-01-15");
    });
  });

  describe("convert with DATETIME type", () => {
    const converter = new PartitionValueConverter("DATETIME");

    test("converts Firebase Timestamp to BigQuery datetime string", () => {
      const timestamp = admin.firestore.Timestamp.fromDate(
        new Date("2024-01-15T10:30:00Z")
      );
      const result = converter.convert(timestamp);
      expect(result).toBeDefined();
      expect(result).toContain("2024-01-15");
    });

    test("converts timestamp-like object to BigQuery datetime string", () => {
      const timestampLike = {
        _seconds: 1705315800,
        _nanoseconds: 0,
      };
      const result = converter.convert(timestampLike);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    test("converts native Date to BigQuery datetime string", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      const result = converter.convert(date);
      expect(result).toBeDefined();
      expect(result).toContain("2024-01-15");
    });
  });
});
