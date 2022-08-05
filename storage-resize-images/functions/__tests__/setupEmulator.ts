export default () => {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "localhost:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = "localhost:9199";
  process.env.GCLOUD_PROJECT = "demo-project";
  process.env.EVENTARC_CHANNEL =
    "projects/extensions-testing/locations/us-central1/channels/firebase";
  process.env.EXT_SELECTED_EVENTS =
    "firebase.extensions.storage-resize-images.v1.complete";
};
