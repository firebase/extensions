export default () => {
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
  process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "localhost:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
  process.env.PUBSUB_EMULATOR_HOST = "localhost:8085";
  process.env.GOOGLE_CLOUD_PROJECT = "demo-test";
};
