const admin = require("firebase-admin");
const { eventarc } = require("firebase-functions/v2");

admin.initializeApp();

exports.test = eventarc.onCustomEventPublished(
  "firebase.extensions.storage-resize-images.v1.complete",
  (e) => {
    console.log("event listener here! >>>>>");
    console.log(JSON.stringify(e));
  }
);
