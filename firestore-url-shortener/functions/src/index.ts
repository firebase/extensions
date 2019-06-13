import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { BitlyClient } from "bitly";

const bitly = new BitlyClient(process.env.ACCESS_TOKEN);

const SHORT_URL_FIELD_NAME = process.env.SHORT_URL_FIELD_NAME;
const URL_FIELD_NAME = process.env.URL_FIELD_NAME;

// Initializing firebase-admin
admin.initializeApp();

// Shorten an incoming URL.
exports.urlshortener = functions.handler.firestore.document.onWrite(
  (change) => {
    if (!change.after.exists) {
      // Document was deleted, ignore
      console.log("Document was deleted, skipping");
      return Promise.resolve();
    } else if (!change.before.exists) {
      // Document was created, check if URL exists
      const url = change.before.get(URL_FIELD_NAME);
      if (url) {
        console.log("Document was created with URL, shortening");
        return shortenUrl(change.after);
      } else {
        console.log("Document was created without a URL, skipping");
        return Promise.resolve();
      }
    } else {
      // Document was updated, check if URL has changed
      const urlAfter = change.after.get(URL_FIELD_NAME);
      const urlBefore = change.before.get(URL_FIELD_NAME);

      if (urlAfter === urlBefore) {
        console.log("Document was updated, URL has not changed, skipping");
        return Promise.resolve();
      }

      if (urlAfter) {
        console.log("Document was updated, URL has changed, shortening");
        return shortenUrl(change.after);
      } else {
        console.log("Document was updated, no URL exists, skipping");
        return Promise.resolve();
      }
    }
  }
);

const shortenUrl = async (
  snapshot: admin.firestore.DocumentSnapshot
): Promise<any> => {
  const url: string = snapshot.get(URL_FIELD_NAME);
  const response = await bitly.shorten(url);
  // Update the document
  return snapshot.ref.update(SHORT_URL_FIELD_NAME, response.url);
};
