/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const requestP = require('request-promise');

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN_NAME = process.env.MAILGUN_DOMAIN_NAME;
const APP_NAME = process.env.APP_NAME;
const INVITATIONS_COLLECTION = process.env.METADATA_FIRESTORE_COLLECTION;
const ACCEPT_URL_TEMPLATE = process.env.ACCEPT_URL_TEMPLATE;
const TARGET_SENDER_FIELDS = process.env.TARGET_SENDER_FIELDS;
const TARGET_RECEIVER_FIELDS = process.env.TARGET_RECEIVER_FIELDS;

admin.initializeApp();
admin.firestore().settings({timestampsInSnapshots: true});


exports.sendInvitation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition',
        'The function must be called while authenticated.');
  }

  const senderUid = context.auth.uid;
  const email = data.email;

  let doc = await admin.firestore()
      .collection(INVITATIONS_COLLECTION)
      .add({
        senderUid,
        email
      });

  let token = doc.id;
  let acceptUrl = ACCEPT_URL_TEMPLATE.replace('{token}', token);
  await sendInvitationEmail({
    email,
    auth: context.auth,
    acceptUrl
  });
  return {acceptUrl};
});


async function sendInvitationEmail({email, auth, acceptUrl}) {
  let emailBodyHtml = `
<p>Hi there ${email},</p>
<p>I'm using ${APP_NAME} and I'd love for you to join me!. <a href="${acceptUrl}">Accept invitation</a></p>
<p>- ${auth.token.name} (via ${APP_NAME})</p>
`;

  return requestP({
    method: 'POST',
    url: `https://api.mailgun.net/v3/${MAILGUN_DOMAIN_NAME}/messages`,
    headers: {
      'Authorization': 'Basic ' + new Buffer(`api:${MAILGUN_API_KEY}`).toString('base64')
    },
    form: {
      from: `${auth.token.name} via ${APP_NAME} <noreply@${MAILGUN_DOMAIN_NAME}>`,
      to: email,
      subject: `Join me on ${APP_NAME}`,
      html: emailBodyHtml,
    }
  });
}


exports.acceptInvitation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition',
        'The function must be called while authenticated.');
  }

  const receiverUid = context.auth.uid;
  const token = data.token;

  const invitationDoc = admin.firestore().collection(INVITATIONS_COLLECTION).doc(token);

  let docSnap = await invitationDoc.get();
  if (!docSnap.exists) {
    throw new functions.https.HttpsError('invalid-argument',
        'Invitation token invalid or expired.');
  }

  let senderUid = docSnap.data().senderUid;
  let templateParams = {sender: senderUid, receiver: receiverUid};
  let receiverDocsFields = parseDocumentFieldPathList(TARGET_RECEIVER_FIELDS, templateParams);
  let senderDocsFields = parseDocumentFieldPathList(TARGET_SENDER_FIELDS, templateParams);

  for (const {docPath, field} of receiverDocsFields) {
    await admin.firestore().doc(docPath).set({
      [field]: admin.firestore.FieldValue.arrayUnion(receiverUid)
    }, {merge: true});
  }

  for (const {docPath, field} of senderDocsFields) {
    await admin.firestore().doc(docPath).set({
      [field]: admin.firestore.FieldValue.arrayUnion(senderUid)
    }, {merge: true});
  }

  await invitationDoc.delete();
  return {done: true};
});


function parseDocumentFieldPathList(str, params = {}) {
  return (str || '').replace(/^\s+|\s+$/g, '').split(/\s*,\s*/).map(s => {
    let [_, docPath, field] = s.match(/(.+)\.(.+)/);
    if (!docPath || !field) {
      throw new Error('Invalid docpath or field');
    }

    // hydrate doc path with template params
    docPath = docPath.replace(/\{(.+?)\}/, (s, p) => (p in params) ? params[p] : s);

    return {docPath, field};
  });
}
