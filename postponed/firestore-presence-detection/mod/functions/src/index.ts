import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

import config from './config';
import * as logs from './logs';

admin.initializeApp();
enum ChangeType {
  CREATE,
  DELETE,
  UPDATE,
}

/**
 * Handler that listens to the document in RTDB containing user/session
 * information. The function calls the correct handler (upserts/deletes).
 */
export const writeToFirestore =
    functions.handler.database.ref.onWrite(async (change, context) => {
      logs.start();
      try {
        const changeType = getChangeType(change);
        const userInfo = getUserAndSessionID(context.resource.name);
        switch (changeType) {
          case ChangeType.UPDATE:
            logs.handleWrite(
                userInfo['userID'], userInfo['sessionID'], 'update');
            await handleUpsert(
                change, userInfo['userID'], userInfo['sessionID']);
            break;
          case ChangeType.DELETE:
            logs.handleWrite(
                userInfo['userID'], userInfo['sessionID'], 'delete');
            await handleDelete(
                change, userInfo['userID'], userInfo['sessionID']);
            break;
          case ChangeType.CREATE:
            logs.handleWrite(
                userInfo['userID'], userInfo['sessionID'], 'create');
            await handleUpsert(
                change, userInfo['userID'], userInfo['sessionID']);
            break;
          default:
            throw new Error(`Invalid change type: ${changeType}`);
        }
        logs.success();
      } catch (err) {
        logs.error(err);
      }
    });

/**
 * Returns the operation performed on the document based on the before/after
 * data snapshot
 */
const getChangeType =
    (change: functions.Change<admin.database.DataSnapshot>): ChangeType => {
      if (!change.after.exists()) {
        return ChangeType.DELETE;
      }
      if (!change.before.exists()) {
        return ChangeType.CREATE;
      }
      return ChangeType.UPDATE;
    };

/**
 * Handles new user sessions and updates to existing user sessions.
 * Adds a global timestamp to indicate last update (subject to race conditions)
 */
const handleUpsert = async(
    change: functions.Change<admin.database.DataSnapshot>, userID: string,
    sessionID: string): Promise<admin.firestore.WriteResult> => {
  if (config.firestore_path === undefined) {
    throw new Error('Undefined firestore path');
  } else {
    const dbRef =
        admin.firestore().collection(config.firestore_path).doc(userID);

    // Determine if the sessionID should be inserted or updated
    return dbRef.get().then((docSnapshot) => {
      logs.handleUpsert(
          `${config.firestore_path}/${userID}/sessions/${sessionID}`,
          change.after.val());
      if (docSnapshot.exists) {
        return dbRef.update({
          ['sessions.' + sessionID]: change.after.val(),
          'last_updated': admin.firestore.Timestamp.now()
        });
      } else {
        return dbRef.create({
          'sessions': {[sessionID]: change.after.val()},
          'last_updated': admin.firestore.Timestamp.now()
        });
      }
    });
  }
};

/**
 * Handles disconnects from existing user sessions.
 * Adds a global timestamp to indicate last update (subject to race conditions)
 */
const handleDelete = async(
    change: functions.Change<admin.database.DataSnapshot>, userID: string,
    sessionID: string): Promise<admin.firestore.WriteResult> => {
  if (config.firestore_path === undefined) {
    throw new Error('Undefined firestore path');
  } else {
    logs.handleDelete(
        `${config.firestore_path}/${userID}/sessions/${sessionID}`);
    return admin.firestore()
        .collection(config.firestore_path)
        .doc(userID)
        .update({
          ['sessions.' + sessionID]: admin.firestore.FieldValue.delete(),
          'last_updated': admin.firestore.Timestamp.now()
        });
  }
};

/**
 * Grab the User and Session ID information from the RTDB path
 * @param path of the function trigger
 */
const getUserAndSessionID = (path: string) => {
  let strArr = path.split('/');
  if (strArr.length < 3) {
    throw new Error(
        'Base path has incorrect number of subdirectories (should not happen).');
  }
  return {
    'userID': strArr[strArr.length - 3],
    'sessionID': strArr[strArr.length - 1],
  };
};
