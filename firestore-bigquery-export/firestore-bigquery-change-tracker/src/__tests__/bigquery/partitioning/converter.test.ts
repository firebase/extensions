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

    test("converts ISO 8601 datetime string to BigQuery timestamp string", () => {
      const result = converter.convert("2024-01-15T10:30:00Z");
      expect(result).toContain("2024-01-15");
    });

    test("converts ISO 8601 date-only string to BigQuery timestamp string", () => {
      const result = converter.convert("2024-01-15");
      expect(result).toContain("2024-01-15");
    });

    test("returns null for unparseable string", () => {
      expect(converter.convert("not-a-date")).toBeNull();
    });

    test("returns null for empty string", () => {
      expect(converter.convert("")).toBeNull();
    });

    test("returns null for partial date (year-month only)", () => {
      expect(converter.convert("2024-01")).toBeNull();
    });

    test("returns null for partial date (year only)", () => {
      expect(converter.convert("2024")).toBeNull();
    });

    test("returns null for bare numeric string", () => {
      expect(converter.convert("1")).toBeNull();
    });

    test("returns null for calendar-invalid date (Feb 30)", () => {
      expect(converter.convert("2024-02-30")).toBeNull();
    });

    test("returns null for non-leap-year Feb 29", () => {
      expect(converter.convert("2023-02-29")).toBeNull();
    });

    test("accepts leap-year Feb 29", () => {
      const result = converter.convert("2024-02-29");
      expect(result).toContain("2024-02-29");
    });

    test("returns null for out-of-range month", () => {
      expect(converter.convert("2024-13-01")).toBeNull();
    });

    test("returns null for out-of-range day", () => {
      expect(converter.convert("2024-01-32")).toBeNull();
    });

    test("returns null for year 0 (outside BigQuery DATE range)", () => {
      expect(converter.convert("0000-01-01")).toBeNull();
    });

    test("accepts year 0001 (BigQuery DATE minimum)", () => {
      const result = converter.convert("0001-01-01");
      expect(result).toContain("0001-01-01");
    });

    test("accepts year 9999 (BigQuery DATE maximum)", () => {
      const result = converter.convert("9999-12-31");
      expect(result).toContain("9999-12-31");
    });

    test("returns null for datetime without timezone", () => {
      expect(converter.convert("2024-01-15T10:30:00")).toBeNull();
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

    test("converts ISO 8601 date-only string to BigQuery date string", () => {
      const result = converter.convert("2024-01-15");
      expect(result).toBe("2024-01-15");
    });

    test("converts ISO 8601 datetime string to BigQuery date string", () => {
      const result = converter.convert("2024-01-15T10:30:00Z");
      expect(result).toBe("2024-01-15");
    });

    test("uses UTC date component for timezone-suffixed datetime string", () => {
      // 2024-01-15T22:00:00-08:00 == 2024-01-16T06:00:00Z. The DATE column
      // takes the UTC date component, matching how Firestore Timestamps are
      // handled. Pinned so future changes to this contract are explicit.
      const result = converter.convert("2024-01-15T22:00:00-08:00");
      expect(result).toBe("2024-01-16");
    });

    test("returns null for unparseable string", () => {
      expect(converter.convert("not-a-date")).toBeNull();
    });

    test("returns null for empty string", () => {
      expect(converter.convert("")).toBeNull();
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

    test("converts ISO 8601 datetime string to BigQuery datetime string", () => {
      const result = converter.convert("2024-01-15T10:30:00Z");
      expect(result).toBeDefined();
      expect(result).toContain("2024-01-15");
    });

    test("converts ISO 8601 date-only string to BigQuery datetime string", () => {
      const result = converter.convert("2024-01-15");
      expect(result).toBeDefined();
      expect(result).toContain("2024-01-15");
    });

    test("returns null for unparseable string", () => {
      expect(converter.convert("not-a-date")).toBeNull();
    });

    test("returns null for empty string", () => {
      expect(converter.convert("")).toBeNull();
    });
  });
});
