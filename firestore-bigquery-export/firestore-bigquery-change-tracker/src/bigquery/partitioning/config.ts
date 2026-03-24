/** Granularity for BigQuery time-based partitioning. */
export type TimePartitioningGranularity = "HOUR" | "DAY" | "MONTH" | "YEAR";

/** BigQuery column type for a custom partitioning field. */
export type PartitioningFieldType = "TIMESTAMP" | "DATE" | "DATETIME";

/** Disables partitioning. */
export interface NoPartitioning {
  granularity?: "NONE" | null | undefined;
  bigqueryColumnName?: undefined;
  bigqueryColumnType?: undefined;
  firestoreFieldName?: undefined;
}

/** Partitions by BigQuery ingestion time. */
export interface IngestionTimePartitioning {
  granularity: TimePartitioningGranularity;
  bigqueryColumnName?: undefined;
  bigqueryColumnType?: undefined;
  firestoreFieldName?: undefined;
}

/** Partitions by the built-in changelog `timestamp` column. */
export interface FirestoreTimestampPartitioning {
  granularity: TimePartitioningGranularity;
  bigqueryColumnName: "timestamp";
  bigqueryColumnType?: PartitioningFieldType;
  firestoreFieldName?: undefined;
}

/** Partitions by an arbitrary Firestore document field. */
export interface FirestoreFieldPartitioning {
  granularity: TimePartitioningGranularity;
  bigqueryColumnName: string;
  bigqueryColumnType: PartitioningFieldType;
  firestoreFieldName: string;
}

/**
 * Discriminated union describing how a BigQuery table should be partitioned.
 *
 * - {@link NoPartitioning} — no partitioning.
 * - {@link IngestionTimePartitioning} — partition by ingestion time.
 * - {@link FirestoreTimestampPartitioning} — partition by the changelog `timestamp` column.
 * - {@link FirestoreFieldPartitioning} — partition by a custom Firestore field.
 */
export type PartitioningStrategy =
  | NoPartitioning
  | IngestionTimePartitioning
  | FirestoreTimestampPartitioning
  | FirestoreFieldPartitioning;

export enum PartitioningType {
  NONE = "NONE",
  INGESTION_TIME = "INGESTION_TIME",
  FIRESTORE_TIMESTAMP = "FIRESTORE_TIMESTAMP",
  FIRESTORE_FIELD = "FIRESTORE_FIELD",
}

/**
 * Wraps a {@link PartitioningStrategy} and determines the effective
 * {@link PartitioningType}.
 */
export class PartitioningConfig {
  private strategy: PartitioningStrategy;
  private type: PartitioningType;

  constructor(strategy?: PartitioningStrategy) {
    this.strategy = strategy ?? { granularity: "NONE" };
    this.type = this.determineType(this.strategy);
  }

  private determineType(strategy: PartitioningStrategy): PartitioningType {
    if (!strategy.granularity || strategy.granularity === "NONE") {
      return PartitioningType.NONE;
    }

    if (!strategy.bigqueryColumnName && !strategy.firestoreFieldName) {
      return PartitioningType.INGESTION_TIME;
    }

    if (
      strategy.bigqueryColumnName === "timestamp" &&
      !strategy.firestoreFieldName
    ) {
      return PartitioningType.FIRESTORE_TIMESTAMP;
    }

    if (
      strategy.bigqueryColumnName &&
      strategy.bigqueryColumnType &&
      strategy.firestoreFieldName
    ) {
      return PartitioningType.FIRESTORE_FIELD;
    }

    throw new Error(
      `Invalid partitioning strategy: ${JSON.stringify(strategy)}`
    );
  }

  getType(): PartitioningType {
    return this.type;
  }

  getStrategy(): PartitioningStrategy {
    return this.strategy;
  }

  isNoPartitioning(): boolean {
    return this.type === PartitioningType.NONE;
  }

  isIngestionTimePartitioning(): boolean {
    return this.type === PartitioningType.INGESTION_TIME;
  }

  isFirestoreTimestampPartitioning(): boolean {
    return this.type === PartitioningType.FIRESTORE_TIMESTAMP;
  }

  isFirestoreFieldPartitioning(): boolean {
    return this.type === PartitioningType.FIRESTORE_FIELD;
  }

  getGranularity(): TimePartitioningGranularity | "NONE" | null | undefined {
    return this.strategy.granularity;
  }

  getBigQueryColumnName(): string | undefined {
    return this.strategy.bigqueryColumnName;
  }

  getBigQueryColumnType(): PartitioningFieldType | undefined {
    return this.strategy.bigqueryColumnType;
  }

  getFirestoreFieldName(): string | undefined {
    return this.strategy.firestoreFieldName;
  }
}
