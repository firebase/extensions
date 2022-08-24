import * as admin from "firebase-admin";
import { smtpServer } from "./createSMTPServer";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";

admin.initializeApp({
  projectId: "demo-test",
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

    const doc = await mailCollection.add(record);

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
  }, 12000);

  test("empty template attachments should default to message attachments", async (): Promise<
    void
  > => {
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

  afterAll(() => {
    server.close();
  });
});
