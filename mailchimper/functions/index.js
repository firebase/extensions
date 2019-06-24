/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const crypto = require("crypto");
const functions = require("firebase-functions");
const Mailchimp = require("mailchimp-api-v3");

const mailchimp = new Mailchimp(process.env.MAILCHIMP_KEY);
const list = process.env.AUDIENCE_ID;

exports.addUserToList = functions.auth.user().onCreate((user) => {
  const email = user.email;
  if (!email) {
    return console.log("User does not have an email");
  }
  return mailchimp
    .post(`/lists/${list}/members`, {
      email_address: email,
      status: "subscribed",
    })
    .then((results) => {
      console.log(
        `Successfully subscribed ${email} to ${list} list. Mailchimp ID: ${
          results.id
        }`
      );
    })
    .catch((err) => {
      console.error("Error when adding customer to Mailchimp list: ", err);
    });
});

exports.removeUserFromList = functions.auth.user().onDelete((user) => {
  const email = user.email;
  if (!email) {
    return console.log("User does not have an email");
  }
  const hashed = crypto
    .createHash("md5")
    .update(email)
    .digest("hex");
  console.log("Hashed email is: ", hashed);
  return mailchimp
    .delete(`/lists/${list}/members/${hashed}`)
    .then((results) => {
      console.log(`Successfully deleted ${email} from ${list} list`);
    })
    .catch((err) => {
      console.error("Error when deleting customer from Mailchimp list: ", err);
    });
});
