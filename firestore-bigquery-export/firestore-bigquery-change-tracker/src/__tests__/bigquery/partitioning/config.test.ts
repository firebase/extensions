import {
  PartitioningConfig,
  PartitioningType,
} from "../../../bigquery/partitioning/config";

describe("PartitioningConfig", () => {
  describe("determineType", () => {
    test("returns NONE when granularity is undefined", () => {
      const config = new PartitioningConfig({});
      expect(config.getType()).toBe(PartitioningType.NONE);
      expect(config.isNoPartitioning()).toBe(true);
    });

    test("returns NONE when granularity is null", () => {
      const config = new PartitioningConfig({ granularity: null });
      expect(config.getType()).toBe(PartitioningType.NONE);
      expect(config.isNoPartitioning()).toBe(true);
    });

    test("returns NONE when granularity is 'NONE'", () => {
      const config = new PartitioningConfig({ granularity: "NONE" });
      expect(config.getType()).toBe(PartitioningType.NONE);
      expect(config.isNoPartitioning()).toBe(true);
    });

    test("returns INGESTION_TIME when only granularity is provided", () => {
      const config = new PartitioningConfig({ granularity: "DAY" });
      expect(config.getType()).toBe(PartitioningType.INGESTION_TIME);
      expect(config.isIngestionTimePartitioning()).toBe(true);
    });

    test("returns INGESTION_TIME for all granularity values", () => {
      const granularities = ["HOUR", "DAY", "MONTH", "YEAR"] as const;
      for (const granularity of granularities) {
        const config = new PartitioningConfig({ granularity });
        expect(config.getType()).toBe(PartitioningType.INGESTION_TIME);
        expect(config.getGranularity()).toBe(granularity);
      }
    });

    test("returns FIRESTORE_TIMESTAMP when bigqueryColumnName is 'timestamp' without firestoreFieldName", () => {
      const config = new PartitioningConfig({
        granularity: "DAY",
        bigqueryColumnName: "timestamp",
      });
      expect(config.getType()).toBe(PartitioningType.FIRESTORE_TIMESTAMP);
      expect(config.isFirestoreTimestampPartitioning()).toBe(true);
    });

    test("returns FIRESTORE_TIMESTAMP with optional columnType", () => {
      const config = new PartitioningConfig({
        granularity: "DAY",
        bigqueryColumnName: "timestamp",
        bigqueryColumnType: "DATETIME",
      });
      expect(config.getType()).toBe(PartitioningType.FIRESTORE_TIMESTAMP);
      expect(config.getBigQueryColumnType()).toBe("DATETIME");
    });

    test("returns FIRESTORE_FIELD when all custom field options are provided", () => {
      const config = new PartitioningConfig({
        granularity: "DAY",
        bigqueryColumnName: "created_at",
        bigqueryColumnType: "TIMESTAMP",
        firestoreFieldName: "createdAt",
      });
      expect(config.getType()).toBe(PartitioningType.FIRESTORE_FIELD);
      expect(config.isFirestoreFieldPartitioning()).toBe(true);
    });
  });

  describe("getter methods", () => {
    test("getStrategy() returns the original strategy", () => {
      const strategy = {
        granularity: "DAY" as const,
        bigqueryColumnName: "test",
        bigqueryColumnType: "TIMESTAMP" as const,
        firestoreFieldName: "test",
      };
      const config = new PartitioningConfig(strategy);
      expect(config.getStrategy()).toEqual(strategy);
    });

    test("all boolean methods return false for non-matching types", () => {
      const config = new PartitioningConfig({ granularity: "DAY" });
      expect(config.isNoPartitioning()).toBe(false);
      expect(config.isFirestoreTimestampPartitioning()).toBe(false);
      expect(config.isFirestoreFieldPartitioning()).toBe(false);
      expect(config.isIngestionTimePartitioning()).toBe(true);
    });

    test("constructor defaults to no partitioning when undefined", () => {
      const config = new PartitioningConfig();
      expect(config.getType()).toBe(PartitioningType.NONE);
      expect(config.getStrategy()).toEqual({});
    });
  });
});
