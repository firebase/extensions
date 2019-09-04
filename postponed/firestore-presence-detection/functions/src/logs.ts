import config from './config';

export const error = (err: Error) => {
  console.error('Error executing mod: ', err);
};

export const start = () => {
  console.log('Started mod execution with config \n', config);
};

export const handleUpsert = (path: string, payload: object) => {
  console.log("Upserting data: "+ payload +" at path: " + path);
};

export const handleDelete = (path: string) => {
  console.log(`Deleting user connection at: ${path}`);
};

export const getSessionInfo = (path: String) => {
  console.log(`Obtaining sessionID and userID from path: ${path}`);
};

export const logTimestampComparison = (currentTimestamp: number, operationTimestamp: number, userID: string, sessionID: string) => {
  console.log(`Comparing timestamps of user: ${userID}, session: ${sessionID}. Current Timestamp: ${currentTimestamp}, Operation Timestamp: ${operationTimestamp}`);
};

export const logFirestoreUpsert = (payload: object) => {
  console.log("Updating Firestore document with payload: " + payload);
};

export const success = () => {
  console.log("User presence extension successfully executed.");
};

export const createDocument = (document: string, collection: string | undefined) => {
  console.log(`Creating document ${document} at Collection ${collection} `);
};

export const logRetry = (error: Error) => {
  console.error('Error commiting RTDB changes, retrying. Error: ', error);
}