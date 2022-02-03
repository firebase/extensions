import { firestore } from "firebase-admin";
import { FirestoreBigQueryEventHistoryTracker } from "../../bigquery";

const docName = "users/doc1";

describe("function getTimePartitionParameterField for generating Time Partition field", () => {
  test("if returns when all config set and pass DATE", () => {
    const firestoreData = { endDate: "12-05-2025" };
    const generatedTimePartitionField = new FirestoreBigQueryEventHistoryTracker(
      {
        datasetId: "dataset",
        tableId: "table",
        datasetLocation: "US",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "TIMESTAMP",
        timePartitioningFirestoreField: "endDate",
        transformFunction: "",
        clustering: [],
      }
    ).getTimePartitionParameterField(firestoreData, docName);
    expect(generatedTimePartitionField.end_date).toBe(firestoreData.endDate);
  });
  test("all config set and pass Firestore Timestamp, should return Date(TIMESTAMP) format", () => {
    const firestoreData = { endDate: firestore.Timestamp.now() };
    const generatedTimePartitionField = new FirestoreBigQueryEventHistoryTracker(
      {
        datasetId: "dataset",
        tableId: "table",
        datasetLocation: "US",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "TIMESTAMP",
        timePartitioningFirestoreField: "endDate",
        transformFunction: "",
        clustering: [],
      }
    ).getTimePartitionParameterField(firestoreData, docName);
    expect(generatedTimePartitionField.end_date).toBeInstanceOf(Date);
  });
  test("all config set and pass wrong value, should return empty object", () => {
    const firestoreData = {};
    const generatedTimePartitionField = new FirestoreBigQueryEventHistoryTracker(
      {
        datasetId: "dataset",
        tableId: "table",
        datasetLocation: "US",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "TIMESTAMP",
        timePartitioningFirestoreField: "endDate",
        transformFunction: "",
        clustering: [],
      }
    ).getTimePartitionParameterField(firestoreData, docName);
    expect(generatedTimePartitionField.end_date).toBe(undefined);
    expect(generatedTimePartitionField).toBeInstanceOf(Object);
  });
  test("all config set with wrong Firestore Firestore field name, should return empty object", () => {
    const firestoreData = { endddddDate: "12-12-2021" };
    const generatedTimePartitionField = new FirestoreBigQueryEventHistoryTracker(
      {
        datasetId: "dataset",
        tableId: "table",
        datasetLocation: "US",
        timePartitioning: "DAY",
        timePartitioningField: "end_date",
        timePartitioningFieldType: "TIMESTAMP",
        timePartitioningFirestoreField: "endDate",
        transformFunction: "",
        clustering: [],
      }
    ).getTimePartitionParameterField(firestoreData, docName);
    expect(generatedTimePartitionField.end_date).toBe(undefined);
    expect(generatedTimePartitionField).toBeInstanceOf(Object);
  });
});
