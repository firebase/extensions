import * as admin from "firebase-admin";
import { firestore } from "firebase-admin";
import { smtpServer } from "./createSMTPServer";

// import wait-for-expect
import waitForExpect from "wait-for-expect";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

admin.initializeApp({
  projectId: "dev-extensions-testing",
});

const mail = "mail";
const mailCollection = admin.firestore().collection(mail);

const templates = "templates";
const templatesCollection = admin.firestore().collection(templates);

let server = null;

describe("e2e testing", () => {
  beforeAll(() => {
    server = smtpServer();
  });

  test("the SMTP function is working", async (): Promise<void> => {
    const record = {
      to: "test-assertion@email.com",
      message: {
        subject: "test",
      },
    };

    const doc = mailCollection.doc();

    let currentSnapshot: firestore.DocumentSnapshot;

    const unsubscribe = doc.onSnapshot((snapshot) => {
      currentSnapshot = snapshot;
    });

    await doc.create(record);

    await waitForExpect(() => {
      expect(currentSnapshot).toHaveProperty("exists");
      expect(currentSnapshot.exists).toBeTruthy();
      const currentDocumentData = currentSnapshot.data();
      expect(currentDocumentData).toHaveProperty("delivery");
      expect(currentDocumentData.delivery).toHaveProperty("info");
      expect(currentDocumentData.delivery.info.accepted[0]).toEqual(record.to);
      expect(currentDocumentData.delivery.info.response).toContain("250");
      unsubscribe();
    });
  }, 12000);

  test("the expireAt field should be added, with value 5 days later than startTime", async (): Promise<void> => {
    const record = {
      to: "test-assertion2@email.com",
      message: {
        subject: "test2",
      },
    };

    const doc = await mailCollection.add(record);

    return new Promise((resolve, reject) => {
      const unsubscribe = doc.onSnapshot((snapshot) => {
        const document = snapshot.data();

        if (
          document.delivery &&
          document.delivery.info &&
          document.delivery.expireAt
        ) {
          const startAt = document.delivery.startTime.toDate();
          const expireAt = document.delivery.expireAt.toDate();
          expect(expireAt.getTime() - startAt.getTime()).toEqual(5 * 86400000);
          unsubscribe();
          resolve();
        }
      });
    });
  }, 12000);

  test("empty template attachments should default to message attachments", async (): Promise<void> => {
    //create template
    const template = await templatesCollection.doc("default").set({
      subject: "@{{username}} is now following you!",
    });

    const record = {
      to: "test-assertion@email.com",
      message: {
        subject: "test",
        attachments: [{ filename: "{{username}}.jpg" }],
      },
      template: { name: "default", data: { username: "foo" } },
    };

    const doc = await mailCollection.add(record);

    return new Promise((resolve, reject) => {
      const unsubscribe = doc.onSnapshot((snapshot) => {
        const document = snapshot.data();

        if (document.delivery && document.delivery.info) {
          expect(document.delivery.info.accepted[0]).toEqual(record.to);
          expect(document.delivery.info.response).toContain("250 Accepted");
          expect(document.message.attachments.length).toEqual(1);
          unsubscribe();
          resolve();
        }
      });
    });
  }, 8000);

  test("should successfully send an email with a basic template", async (): Promise<void> => {
    /** create basic template */
    const template = await templatesCollection.add({
      subject: "@{{username}} is now following you!",
    });

    /** Add a record with the template and no message object */
    const record = {
      to: "test-assertion@email.com",
      template: {
        name: template.id,
        data: {
          username: "ada",
        },
      },
    };

    /** Add a new mail document */
    const doc = await mailCollection.add(record);

    /** Check the email response  */
    return new Promise((resolve, reject) => {
      const unsubscribe = doc.onSnapshot((snapshot) => {
        const document = snapshot.data();

        if (document.delivery && document.delivery.info) {
          expect(document.delivery.info.accepted[0]).toEqual(record.to);
          expect(document.delivery.info.response).toContain("250 Accepted");

          unsubscribe();
          resolve();
        }
      });
    });
  });

  test("should successfully send an email with a SendGrid template", async (): Promise<void> => {
    /** Add a record with the template and no message object */
    const record = {
      from: process.env.SENDGRID_FROM_EMAIL,
      to: "test-assertion@email.com",
      sendGridDynamicTemplate: {
        templateId: "d-61eb136ddb8146f2b6e1fe7b54a1dcf0",
      },
    };

    let currentSnapshot: firestore.DocumentSnapshot;

    /** Add a new mail document */
    const doc = await firestore().collection("mail-sg").add(record);

    const unsubscribe = doc.onSnapshot((snapshot) => {
      currentSnapshot = snapshot;
    });

    await waitForExpect(() => {
      const document = currentSnapshot.data();
      expect(document.delivery.state).toEqual("SUCCESS");

      unsubscribe();
    });
  });

  test("should error when sending an email with an empty SendGrid template", async (): Promise<void> => {
    /** Add a record with the template and no message object */
    const record = {
      to: "test-assertion@email.com",
      sendGridDynamicTemplate: {},
    };

    /** Add a new mail document */
    const doc = await firestore().collection("mail-sg").add(record);

    let currentSnapshot: firestore.DocumentSnapshot;

    const unsubscribe = doc.onSnapshot((snapshot) => {
      currentSnapshot = snapshot;
    });

    await waitForExpect(() => {
      const document = currentSnapshot.data();

      expect(document.delivery.state).toEqual("ERROR");
      expect(document.delivery.error).toEqual(
        "Error: SendGrid templateId is not provided, if you're using SendGrid Dynamic Templates, please provide a valid templateId, otherwise provide a `text` or `html` content."
      );

      unsubscribe();
    });
  });

  afterAll(() => {
    server.close();
  });
});
