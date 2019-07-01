import config from "./config";

export const complete = (uid: string) => {
  console.log(`Successfully removed data for user: ${uid}`);
};

export const firestoreDeleted = () => {
  console.log("Finished deleting user data from Cloud Firestore");
};

export const firestoreDeleting = () => {
  console.log("Deleting user data from Cloud Firestore");
};

export const firestoreNotConfigured = () => {
  console.log("Cloud Firestore paths are not configured, skipping");
};

export const firestorePathDeleted = (path: string) => {
  console.log(`Deleted: '${path}' from Cloud Firestore`);
};

export const firestorePathDeleting = (path: string) => {
  console.log(`Deleting: '${path}' from Cloud Firestore`);
};

export const firestorePathError = (path: string, err: Error) => {
  console.error(`Error deleting: '${path}' from Cloud Firestore`, err);
};

export const init = () => {
  console.log("Initialising mod with configuration", config);
};

export const rtdbDeleted = () => {
  console.log("Finished deleting user data from the Realtime Database");
};

export const rtdbDeleting = () => {
  console.log("Deleting user data from the Realtime Database");
};

export const rtdbPathDeleted = (path: string) => {
  console.log(`Deleted: '${path}' from the Realtime Database`);
};

export const rtdbNotConfigured = () => {
  console.log("Realtime Database paths are not configured, skipping");
};

export const rtdbPathDeleting = (path: string) => {
  console.log(`Deleting: '${path}' from the Realtime Database`);
};

export const rtdbPathError = (path: string, err: Error) => {
  console.error(`Error deleting: '${path}' from the Realtime Database`, err);
};

export const start = () => {
  console.log("Started mod execution with configuration", config);
};

export const storageDeleted = () => {
  console.log("Finished deleting user data from Cloud Storage");
};

export const storageDeleting = () => {
  console.log("Deleting user data from Cloud Storage");
};

export const storageNotConfigured = () => {
  console.log("Cloud Storage paths are not configured, skipping");
};

export const storagePathDeleted = (path: string) => {
  console.log(`Deleted: '${path}' from Cloud Storage`);
};

export const storagePathDeleting = (path: string) => {
  console.log(`Deleting: '${path}' from Cloud Storage`);
};

export const storagePathError = (path: string, err: Error) => {
  console.error(`Error deleting: '${path}' from Cloud Storage`, err);
};
