import * as admin from "firebase-admin";
import * as functions from "firebase-functions/lib/v2";

import setupEmulator from "./setupEmulator";

const config = {
  projectId: "demo-project",
  storageBucket: "gs://demo-project.appspot.com",
};

setupEmulator();
const app = admin.initializeApp({ projectId: "demo-project" });

describe("extension", () => {
  test("'generateResizedImage' function is exported", async () => {
    //Set filepath
    const filePath = `${__dirname}/test-image.gif`;

    // The new ID for your GCS file
    const uniqueName = (Math.random() + 1).toString(36).substring(7);
    const destFileName = `${uniqueName}.gif`;

    // Creates a client
    const bucket = admin.storage(app).bucket(config.storageBucket);

    return new Promise(async (resolve) => {
      // functions.eventarc.onCustomEventPublished(
      //   "firebase.extensions.storage-resize-images.v1.complete",
      //   (e) => {
      //     console.log("here! >>>>>");
      //     console.log(JSON.stringify(e));
      //     return resolve(true);
      //   }
      // );

      // Upload file
      await bucket
        .upload(filePath, { destination: destFileName })
        .then((data) => {
          console.log("upload success");
        });
    });
  }, 120000);
});
