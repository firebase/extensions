import { initializeApp, apps, app } from "firebase-admin";

let db = null;
let initialized;

export default function initialize() {
  if (initialized === true || apps.length) {
    const firebaseApp = app();

    return { firebaseApp, db };
  }

  initialized = true;
  initializeApp({ projectId: "extensions-testing" });
  db = app().firestore();
  db.settings({ timestampsInSnapshots: true });

  const firebaseApp = app();

  return { firebaseApp, db };
}
