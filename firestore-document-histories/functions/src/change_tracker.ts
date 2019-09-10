import * as firebase from "firebase-admin";
import * as functions from "firebase-functions";
import {Change, EventContext} from "firebase-functions";
import * as _ from "lodash";
import {getHistoryDiffs} from "./diff";
import {DocumentSnapshot} from 'firebase-functions/lib/providers/firestore';

export enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
}

export function getChangeType(change: functions.Change<firebase.firestore.DocumentSnapshot>): ChangeType {
  if (!change.after.exists) {
    return ChangeType.DELETE;
  }
  if (!change.before.exists) {
    return ChangeType.CREATE;
  }
  return ChangeType.UPDATE;
}

export function getTimestamp(context: EventContext, change: Change<DocumentSnapshot>): Date {
  const changeType = getChangeType((change));
  switch (changeType) {
    case ChangeType.CREATE:
      return change.after.updateTime.toDate();
    case ChangeType.DELETE:
      // Due to an internal bug (129264426), before.update_time is actually the commit timestamp.
      return new Date(change.before.updateTime.toDate().getTime() + 1);
    case ChangeType.UPDATE:
      return change.after.updateTime.toDate();
    default: {
      throw new Error(`Invalid change type: ${changeType}`);
    }
  }
}

export function getData(change: functions.Change<firebase.firestore.DocumentSnapshot>): any {
  const changeType = getChangeType((change));
  let data: any = changeType == ChangeType.DELETE ? {} : change.after.data();
  data.__diff = getHistoryDiffs(
    changeType,
    changeType == ChangeType.CREATE ? null: change.before.data(),
    changeType == ChangeType.DELETE ? null: change.after.data());
  return data;
}

