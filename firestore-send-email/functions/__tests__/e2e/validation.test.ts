/**
 * E2E tests for attachment validation edge cases.
 *
 * Tests that the extension handles various attachment formats gracefully:
 * - Missing attachments field
 * - Null attachments
 * - Single attachment object (should normalize to array)
 * - Empty objects in attachments array (should be filtered out)
 *
 * Run with: npm run test:e2e
 */

import * as admin from "firebase-admin";
import { clearCollections, getTestEmail } from "./setup";

const TEST_TEMPLATE = {
  name: "validation_test_template",
  subject: "Test Subject {{id}}",
  text: "Test content for {{id}}",
  html: "<p>Test content for {{id}}</p>",
};

describe.skip("Attachment validation edge cases", () => {
  beforeEach(async () => {
    await clearCollections();

    const db = admin.firestore();
    await db.collection("templates").doc(TEST_TEMPLATE.name).set({
      subject: TEST_TEMPLATE.subject,
      text: TEST_TEMPLATE.text,
      html: TEST_TEMPLATE.html,
    });
  });

  test("should process template email without attachments field", async () => {
    const db = admin.firestore();

    const testData = {
      template: {
        name: TEST_TEMPLATE.name,
        data: { id: "test-1" },
      },
      to: getTestEmail(),
    };

    const docRef = db.collection("mail").doc("test-no-attachments");
    await docRef.set(testData);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const doc = await docRef.get();
    const updatedData = doc.data();

    expect(updatedData?.delivery.state).toBe("SUCCESS");
    expect(updatedData?.delivery.error).toBeNull();
  });

  test("should process template email with null message attachments", async () => {
    const db = admin.firestore();

    const testData = {
      template: {
        name: TEST_TEMPLATE.name,
        data: { id: "test-2" },
      },
      message: {
        attachments: null,
      },
      to: getTestEmail(),
    };

    const docRef = db
      .collection("emailCollection")
      .doc("test-null-attachments");
    await docRef.set(testData);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const doc = await docRef.get();
    const updatedData = doc.data();

    expect(updatedData?.delivery.state).toBe("SUCCESS");
    expect(updatedData?.delivery.error).toBeNull();
  });

  test("should normalize single attachment object to array", async () => {
    const db = admin.firestore();

    const testData = {
      template: {
        name: TEST_TEMPLATE.name,
        data: { id: "test-3" },
      },
      message: {
        attachments: {
          filename: "test.txt",
          content: "test content",
        },
      },
      to: getTestEmail(),
    };

    const docRef = db
      .collection("emailCollection")
      .doc("test-object-attachment");
    await docRef.set(testData);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const doc = await docRef.get();
    const updatedData = doc.data();

    expect(updatedData?.delivery.state).toBe("SUCCESS");
    expect(updatedData?.delivery.error).toBeNull();
  });

  test("should filter out empty objects in attachments array", async () => {
    const db = admin.firestore();

    const testData = {
      template: {
        name: TEST_TEMPLATE.name,
        data: { id: "test-4" },
      },
      message: {
        attachments: [{}],
      },
      to: getTestEmail(),
    };

    const docRef = db
      .collection("emailCollection")
      .doc("test-empty-attachment");
    await docRef.set(testData);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const doc = await docRef.get();
    const updatedData = doc.data();

    expect(updatedData?.delivery.state).toBe("SUCCESS");
    expect(updatedData?.delivery.error).toBeNull();
  });
});
