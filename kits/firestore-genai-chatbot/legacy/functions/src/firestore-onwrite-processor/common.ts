import { Change as FirestoreChange } from "firebase-functions/v1";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { FieldValue, GeoPoint, Timestamp } from "firebase-admin/firestore";
export type Change = FirestoreChange<DocumentSnapshot>;

export enum ChangeType {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
}

export enum State {
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  ERROR = "ERROR",
}

export interface Status {
  state: State;
  updateTime: Timestamp;
  startTime: Timestamp;
}

// TODO missing reference type
export type FirestoreField =
  | string
  | number
  | boolean
  | Timestamp
  | Array<any>
  | Record<string, any>
  | GeoPoint
  | undefined
  | null;

export const now = () => FieldValue.serverTimestamp();

export interface ProcessConfig<
  TInput,
  TOutput extends Record<string, FirestoreField>
> {
  inputField: string;
  processFn: (val: TInput, after: DocumentSnapshot) => Promise<TOutput>;
  errorFn: (e: unknown) => string;
  statusField?: string;
  orderField?: string;
}

export const getChangeType = (change: Change) => {
  if (!change.before || !change.before.exists) {
    return ChangeType.CREATE;
  }
  if (!change.after || !change.after.exists) {
    return ChangeType.DELETE;
  }
  return ChangeType.UPDATE;
};

export const isDelete = (change: Change) =>
  getChangeType(change) === ChangeType.DELETE;

export const isUpdate = (change: Change) =>
  getChangeType(change) === ChangeType.UPDATE;

export const isCreate = (change: Change) =>
  getChangeType(change) === ChangeType.CREATE;
