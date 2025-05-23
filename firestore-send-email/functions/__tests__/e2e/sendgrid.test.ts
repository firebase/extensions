// This test suite assumes local emulator is running the extension, with the following config:

//  AUTH_TYPE=UsernamePassword
//  DATABASE=(default)
//  DATABASE_REGION=us-east1
//  DEFAULT_FROM=<some-email>
//  MAIL_COLLECTION=emailCollection
//  OAUTH_PORT=465
//  SMTP_CONNECTION_URI=smtps://apikey@smtp.sendgrid.net:465
//  TEMPLATES_COLLECTION=emailTemplates
//  TTL_EXPIRE_TYPE=never
//  TTL_EXPIRE_VALUE=1

// set the TEST_EMAIL environment variable to the recipient email address for the test
const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com";

//  and that the sendgrid api key is set as a secret for the emulator in a .secret.local file

import * as admin from "firebase-admin";

// Test data constants
const TEST_TEMPLATE = {
  name: "test_template",
  subject: "Test Subject",
  text: `Hello {{userName}},

Thank you for your order:
{{orderText}}

Your order will be processed by {{doctorName}}.

Business Hours:
{{openingHours}}

Address:
{{address}}

Best regards,
The Team`,
  html: `
<!DOCTYPE html>
<html>
<body>
  <p>Hello {{userName}},</p>
  <p>Thank you for your order: {{orderText}}</p>
  <p>Your order will be processed by {{doctorName}}.</p>
  <p>Business Hours: {{openingHours}}</p>
  <p>Address: {{address}}</p>
  <p>Best regards,<br>The Team</p>
</body>
</html>`,
};

const TEST_TEMPLATE_DATA = {
  address: "123 Test Street, Test City",
  doctorName: "Dr. Test",
  openingHours: "Mon-Fri: 9:00-17:00",
  orderText: "Test order items",
  userName: "Test User",
};

const TEST_COLLECTIONS = ["emailCollection", "emailTemplates"] as const;

// Skip the entire suite if E2E_SENDGRID is not set to true
(process.env.E2E_SENDGRID === "true" ? describe : describe.skip)(
  "SendGrid E2E Tests",
  () => {
    beforeAll(() => {
      // Initialize with emulator settings
      admin.initializeApp({
        projectId: "demo-test",
      });

      // Point Firestore to the emulator
      process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
    });

    beforeEach(async () => {
      // Clear all data from the emulator
      const db = admin.firestore();

      for (const collection of TEST_COLLECTIONS) {
        const snapshot = await db.collection(collection).get();
        const batch = db.batch();

        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
      }

      // Create the email template
      await db.collection("emailTemplates").doc(TEST_TEMPLATE.name).set({
        subject: TEST_TEMPLATE.subject,
        text: TEST_TEMPLATE.text,
        html: TEST_TEMPLATE.html,
      });
    });

    test("should process a template-based email document", async () => {
      const db = admin.firestore();

      const testData = {
        message: {
          attachments: [],
          html: null,
          text: null,
          subject: TEST_TEMPLATE.subject,
        },
        template: {
          data: TEST_TEMPLATE_DATA,
          name: TEST_TEMPLATE.name,
        },
        to: TEST_EMAIL,
      };

      // Write the document to the emulator
      const docRef = db.collection("emailCollection").doc("test-doc");
      await docRef.set(testData);

      // Wait a bit for the function to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify the document was updated
      const doc = await docRef.get();
      const updatedData = doc.data();

      // Assert the delivery state was updated to SUCCESS
      console.log("updatedData", updatedData);
      expect(updatedData?.delivery.state).toBe("SUCCESS");
      expect(updatedData?.delivery.attempts).toBe(1);
      expect(updatedData?.delivery.endTime).toBeDefined();
      expect(updatedData?.delivery.error).toBeNull();

      // Verify SendGrid specific info
      expect(updatedData?.delivery.info).toBeDefined();
      expect(updatedData?.delivery.info?.messageId).toBeDefined();
      expect(updatedData?.delivery.info?.accepted).toContain(TEST_EMAIL);
      expect(updatedData?.delivery.info?.rejected).toEqual([]);
      expect(updatedData?.delivery.info?.pending).toEqual([]);
    });

    test("should process an email with friendly name in from field", async () => {
      const db = admin.firestore();

      const testData = {
        message: {
          attachments: [],
          html: "<p>Test email with friendly name</p>",
          text: "Test email with friendly name",
          subject: "Test Friendly Name",
          from: "Friendly Firebaser test@example.com",
        },
        to: TEST_EMAIL,
      };

      // Write the document to the emulator
      const docRef = db.collection("emailCollection").doc("test-friendly-name");
      await docRef.set(testData);

      // Wait a bit for the function to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify the document was updated
      const doc = await docRef.get();
      const updatedData = doc.data();

      // Assert the delivery state was updated to SUCCESS
      console.log("updatedData with friendly name", updatedData);
      expect(updatedData?.delivery.state).toBe("SUCCESS");
      expect(updatedData?.delivery.attempts).toBe(1);
      expect(updatedData?.delivery.endTime).toBeDefined();
      expect(updatedData?.delivery.error).toBeNull();

      // Verify SendGrid specific info
      expect(updatedData?.delivery.info).toBeDefined();
      expect(updatedData?.delivery.info?.messageId).toBeDefined();
      expect(updatedData?.delivery.info?.accepted).toContain(TEST_EMAIL);
      expect(updatedData?.delivery.info?.rejected).toEqual([]);
      expect(updatedData?.delivery.info?.pending).toEqual([]);
    });
  }
);
