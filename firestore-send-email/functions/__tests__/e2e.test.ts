import * as admin from "firebase-admin";
import { UserRecord } from "firebase-functions/v1/auth";

import { smtpServer } from "./createSMTPServer";

process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
process.env.FIREBASE_FIRESTORE_EMULATOR_ADDRESS = "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";

admin.initializeApp({
  projectId: "extensions-testing",
});

const mail = "mail";
const mailCollection = admin.firestore().collection(mail);

const templates = "templates";
const templatesCollection = admin.firestore().collection(templates);

let server = null;

describe("e2e testing", () => {
  let user: UserRecord | undefined = null;

  beforeAll(async () => {
    server = smtpServer();

    const createdUser = await admin.auth().createUser({
      email: `${(Math.random() + 1).toString(36).substring(7)}@google.com`,
      displayName: "test_name",
    });

    user = createdUser;
  });

  test("the SMTP function is working", async (): Promise<void> => {
    const record = { to: user.email, message: { subject: "test" } };

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
      to: user.email,
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
