export type TimePartitioningGranularity = "HOUR" | "DAY" | "MONTH" | "YEAR";

export type PartitioningFieldType = "TIMESTAMP" | "DATE" | "DATETIME";

export interface BasePartitioningConfig {
  granularity?: TimePartitioningGranularity | "NONE" | null;
  bigqueryColumnName?: string;
  bigqueryColumnType?: PartitioningFieldType;
  firestoreFieldName?: string;
}

export interface NoPartitioning extends BasePartitioningConfig {
  granularity?: "NONE" | null | undefined;
  bigqueryColumnName?: undefined;
  bigqueryColumnType?: undefined;
  firestoreFieldName?: undefined;
}

export interface IngestionTimePartitioning extends BasePartitioningConfig {
  granularity: TimePartitioningGranularity;
  bigqueryColumnName?: undefined;
  bigqueryColumnType?: undefined;
  firestoreFieldName?: undefined;
}

export interface FirestoreTimestampPartitioning extends BasePartitioningConfig {
  granularity: TimePartitioningGranularity;
  bigqueryColumnName: "timestamp";
  bigqueryColumnType?: PartitioningFieldType;
  firestoreFieldName?: undefined;
}

export interface FirestoreFieldPartitioning extends BasePartitioningConfig {
  granularity: TimePartitioningGranularity;
  bigqueryColumnName: string;
  bigqueryColumnType: PartitioningFieldType;
  firestoreFieldName: string;
}

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

export class PartitioningConfig {
  private strategy: PartitioningStrategy;
  private type: PartitioningType;

  constructor(config: PartitioningStrategy) {
    this.strategy = config;
    this.type = this.determineType(config);
  }

  private determineType(config: PartitioningStrategy): PartitioningType {
    if (!config.granularity || config.granularity === "NONE") {
      return PartitioningType.NONE;
    }

    if (!config.bigqueryColumnName && !config.firestoreFieldName) {
      return PartitioningType.INGESTION_TIME;
    }

    if (
      config.bigqueryColumnName === "timestamp" &&
      !config.firestoreFieldName
    ) {
      return PartitioningType.FIRESTORE_TIMESTAMP;
    }

    if (
      config.bigqueryColumnName &&
      config.bigqueryColumnType &&
      config.firestoreFieldName
    ) {
      return PartitioningType.FIRESTORE_FIELD;
    }

    return PartitioningType.NONE;
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

  static none(): PartitioningConfig {
    return new PartitioningConfig({ granularity: "NONE" });
  }

  static ingestionTime(
    granularity: TimePartitioningGranularity
  ): PartitioningConfig {
    return new PartitioningConfig({ granularity });
  }

  static firestoreTimestamp(
    granularity: TimePartitioningGranularity,
    columnType?: PartitioningFieldType
  ): PartitioningConfig {
    return new PartitioningConfig({
      granularity,
      bigqueryColumnName: "timestamp",
      bigqueryColumnType: columnType,
    });
  }

  static firestoreField(
    granularity: TimePartitioningGranularity,
    bigqueryColumnName: string,
    bigqueryColumnType: PartitioningFieldType,
    firestoreFieldName: string
  ): PartitioningConfig {
    return new PartitioningConfig({
      granularity,
      bigqueryColumnName,
      bigqueryColumnType,
      firestoreFieldName,
    });
  }
}
