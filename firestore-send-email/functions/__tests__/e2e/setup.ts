import * as admin from "firebase-admin";

export const TEST_COLLECTIONS = ["mail", "templates"] as const;

// Initialize Firebase Admin once for all e2e tests
beforeAll(() => {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: "demo-test" });
  }
  process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
});

/**
 * Clears all documents from test collections.
 * Call this in beforeEach to ensure clean state between tests.
 */
export async function clearCollections() {
  const db = admin.firestore();
  for (const collection of TEST_COLLECTIONS) {
    const snapshot = await db.collection(collection).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

/**
 * Gets the test email address from environment or returns default.
 */
export function getTestEmail() {
  return process.env.TEST_EMAIL || "test@example.com";
}
