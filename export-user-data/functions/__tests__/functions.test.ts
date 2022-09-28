import setupEnvironment from "./helpers/setupEnvironment";
setupEnvironment();

import * as admin from "firebase-admin";
const fft = require("firebase-functions-test")();

import * as funcs from "../src/index";
import * as config from "../src/config";
import { firestore } from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: "demo-test" });
}

const auth = admin.auth();

/** prepare extension functions */
const exportUserDataFn = fft.wrap(funcs.exportUserData);

describe("functions testing", () => {
  let user;
  beforeEach(async () => {
    /** create example user */
    user = await auth.createUser({});
    await exportUserDataFn.call({ auth: { uid: user.uid } });
  });

  test("test", async () => {
    console.log("test");
  });
});
