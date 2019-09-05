import config from './config';

export const error = (err: Error) => {
  console.error('Error executing mod: ', err);
};

export const nonFatalError = (err: Error) => {
  console.error('Non-fatal error encountered (continuing execution): ', err);
};

export const start = () => {
  console.log('Started mod execution with config \n', config);
};

export const handleCreate = (sessionID: string) => {
  console.log(`Detected new connection. Creating new path: ${sessionID}`);
};

export const handleUpdate = (sessionID: string, payload: object) => {
  console.log(`Detected metadata update for session: ${sessionID} with payload: ${JSON.stringify(payload)}`);
};

export const handleDelete = (sessionID: string) => {
  console.log(`Detected disconnect. Removing connection: ${sessionID}`);
};

export const sessionInfo = (sessionID: string, userID: string) => {
  console.log(`Mod executing for user: ${userID}, connection: ${sessionID}`);
};

export const staleTimestamp = (currentTimestamp: number, operationTimestamp: number, userID: string, sessionID: string) => {
  console.log(`Timestamp of current operation is older than timestamp at destination. Refusing to commit change.` +
      `(user: ${userID}, session: ${sessionID} | Destination Timestamp: ${currentTimestamp}, Operation Timestamp: ${operationTimestamp})`);
};

export const successfulFirestoreTransaction = (payload: object) => {
  console.log(`Firestore document successfully updated with payload: ${JSON.stringify(payload)}`);
};

export const success = () => {
  console.log("User presence extension successfully executed.");
};

export const createDocument = (document: string, collection: string | undefined) => {
  console.log(`Creating document ${document} at Collection ${collection} `);
};

export const retry = (err: Error) => {
  console.error('Error commiting changes to Firestore, retrying. Error: ', err);
};

export const tombstoneRemoval = (updateArr: object) => {
  console.log(`Removing the following tombstones: ${JSON.stringify(updateArr)}`);
};

export const currentDocument = (document: string) => {
  console.log(`Reading Document: ${document}`);
};
