export default () => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.PUBSUB_EMULATOR_HOST = "127.0.0.1:8085";
  process.env.GOOGLE_CLOUD_PROJECT = "demo-test";
};
