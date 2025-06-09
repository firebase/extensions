import * as firebase from "firebase-admin";
import { BigQuery } from "@google-cloud/bigquery";

export class PartitionValueConverter {
  constructor(private fieldType: "TIMESTAMP" | "DATE" | "DATETIME") {}

  private isTimestampLike(
    value: any
  ): value is { _seconds: number; _nanoseconds: number } {
    return (
      value !== null &&
      typeof value === "object" &&
      typeof value._seconds === "number" &&
      typeof value._nanoseconds === "number"
    );
  }

  convert(value: unknown): string | null {
    let date: Date;

    if (value instanceof firebase.firestore.Timestamp) {
      date = value.toDate();
    } else if (this.isTimestampLike(value)) {
      date = new firebase.firestore.Timestamp(
        value._seconds,
        value._nanoseconds
      ).toDate();
    } else if (value instanceof Date && !isNaN(value.getTime())) {
      date = value;
    } else {
      return null;
    }

    switch (this.fieldType) {
      case "DATETIME":
        return BigQuery.datetime(date.toISOString()).value;
      case "DATE":
        return BigQuery.date(date.toISOString().substring(0, 10)).value;
      case "TIMESTAMP":
        return BigQuery.timestamp(date).value;
    }
  }
}
