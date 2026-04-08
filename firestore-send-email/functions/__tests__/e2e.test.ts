import * as admin from "firebase-admin";
import { smtpServer } from "./createSMTPServer";

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

admin.initializeApp({
  projectId: "demo-test",
});

const mail = "mail";
const mailCollection = admin.firestore().collection(mail);

const mailSg = "mail-sg";
const mailSgCollection = admin.firestore().collection(mailSg);

const templates = "templates";
const templatesCollection = admin.firestore().collection(templates);

let server = null;

// TODO: fix and reenable - broken in CI
describe.skip("e2e testing", () => {
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

    const doc = await mailCollection.add(record);

    return new Promise((resolve, reject) => {
      const unsubscribe = doc.onSnapshot(async (snapshot) => {
        const currentDocumentData = snapshot.data();
        if (currentDocumentData.delivery && currentDocumentData.delivery.info) {
          expect(currentDocumentData).toHaveProperty("delivery");
          expect(currentDocumentData.delivery).toHaveProperty("info");
          expect(currentDocumentData.delivery.info.accepted[0]).toEqual(
            record.to
          );
          expect(currentDocumentData.delivery.info.response).toContain("250");
          unsubscribe();
          resolve();
        }
      });
    });
  });

  test("the expireAt field should be added, with value 5 days later than startTime", async (): Promise<void> => {
    const record = {
      to: "test-assertion2@email.com",
      message: {
        subject: "test2",
      },
    };

    const doc = await mailCollection.add(record);

    return new Promise((resolve, reject) => {
      const unsubscribe = doc.onSnapshot(async (snapshot) => {
        const currentDocumentData = snapshot.data();
        if (
          currentDocumentData.delivery &&
          currentDocumentData.delivery.info &&
          currentDocumentData.delivery.expireAt
        ) {
          const startAt = currentDocumentData.delivery.startTime.toDate();
          const expireAt = currentDocumentData.delivery.expireAt.toDate();
          expect(expireAt.getTime() - startAt.getTime()).toEqual(5 * 86400000);
          unsubscribe();
          resolve();
        }
      });
    });
  });

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

    return new Promise((resolve) => {
      const unsubscribe = doc.onSnapshot(async (snapshot) => {
        const document = snapshot.data();

        if (document.delivery && document.delivery.info) {
          const startAt = document.delivery.startTime.toDate();
          const expireAt = document.delivery.expireAt.toDate();
          expect(document.delivery.info.accepted[0]).toEqual(record.to);
          expect(document.delivery.info.response).toContain("250 Accepted");
          expect(document.message.attachments.length).toEqual(1);
          unsubscribe();
          resolve();
        }
      });
    });
  });

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

    return new Promise((resolve) => {
      const unsubscribe = doc.onSnapshot(async (snapshot) => {
        const document = snapshot.data();

        if (document.delivery && document.delivery.info) {
          if (document.delivery && document.delivery.info) {
            expect(document.delivery.info.accepted[0]).toEqual(record.to);
            expect(document.delivery.info.response).toContain("250 Accepted");

            unsubscribe();
            resolve();
          }
        }
      });
    });
  });

  test("should successfully send an email with a SendGrid template", async (): Promise<void> => {
    /** Add a record with the template and no message object */
    const record = {
      to: "test-assertion@email.com",
      sendGrid: {
        templateId: "d-61eb136ddb8146f2b6e1fe7b54a1dcf0",
        mailSettings: {
          sandbox_mode: {
            enable: true,
          },
        },
      },
    };

    const doc = await mailSgCollection.add(record);

    return new Promise((resolve, reject) => {
      const unsubscribe = doc.onSnapshot((snapshot) => {
        const document = snapshot.data();
        if (document.delivery && document.delivery.info) {
          expect(document.delivery.state).toEqual("SUCCESS");
          unsubscribe();
          resolve();
        } else {
          if (document.delivery && document.delivery.error) {
            unsubscribe();
            reject(document.delivery.error);
          }
        }
      });
    });
  }, 12000);

  test("should error when sending an email with an empty SendGrid template", async (): Promise<void> => {
    const record = {
      to: "test-assertion@email.com",
      sendGrid: {
        mailSettings: {
          sandbox_mode: {
            enable: true,
          },
        },
      },
    };

    const doc = await mailSgCollection.add(record);

    return new Promise((resolve) => {
      const unsubscribe = doc.onSnapshot(async (snapshot) => {
        const document = snapshot.data();

        if (document.delivery && document.delivery.error) {
          expect(document.delivery.state).toEqual("ERROR");
          expect(document.delivery.error).toEqual(
            `Error: SendGrid templateId is not provided, if you're using SendGrid Dynamic Templates, please provide a valid templateId, otherwise provide a \`text\` or \`html\` content.`
          );
          unsubscribe();
          resolve();
        }
      });
    });
  }, 12000);

  afterAll(() => {
    server.close();
  });
});
