const admin = require("firebase-admin");
const { eventarc } = require("firebase-functions/v2");

admin.initializeApp();

exports.stripetesting = eventarc.onCustomEventPublished(
  "com.stripe.v1.product.created",
  (e) => {
    console.log("stripe here! >>>>>");
    console.log(JSON.stringify(e));
  }
);
