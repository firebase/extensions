/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const sgMail = require('@sendgrid/mail');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_ALIAS = process.env.SENDGRID_EMAIL_ALIAS;
const APP_NAME = process.env.APP_NAME;
const INVITATIONS_COLLECTION = process.env.METADATA_FIRESTORE_COLLECTION;
const ACCEPT_URL_TEMPLATE = process.env.ACCEPT_URL_TEMPLATE;
const TARGET_SENDER_FIELDS = process.env.TARGET_SENDER_FIELDS;
const TARGET_RECEIVER_FIELDS = process.env.TARGET_RECEIVER_FIELDS;

admin.initializeApp();
sgMail.setApiKey(SENDGRID_API_KEY);


exports.sendInvitation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition',
        'The function must be called while authenticated.');
  }

  const senderUid = context.auth.uid;
  const email = data.email;

  const doc = await admin.firestore()
      .collection(INVITATIONS_COLLECTION)
      .add({
        senderUid,
        email
      });

  const token = doc.id;
  const acceptUrl = ACCEPT_URL_TEMPLATE.replace('{token}', token);
  await sendInvitationEmail({
    email,
    auth: context.auth,
    acceptUrl
  });
  return {acceptUrl};
});


async function sendInvitationEmail({email, auth, acceptUrl}) {
  const emailBodyHtml = `
<p>Hi there ${email},</p>
<p>I'm using ${APP_NAME} and I'd love for you to join me! <a href="${acceptUrl}">Accept invitation</a></p>
<p>- ${auth.token.name} (via ${APP_NAME})</p>
`;

  const msg = {
    to: email,
    from: EMAIL_ALIAS,
    subject: `Join me on ${APP_NAME}`,
    html: emailBodyHtml,
  };

  return sgMail.send(msg).catch((err) => {
    // Errors weren't being printed correctly in functions logs.
    throw new Error(JSON.stringify(err, null, 2));
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

  const docSnap = await invitationDoc.get();
  if (!docSnap.exists) {
    throw new functions.https.HttpsError('invalid-argument',
        'Invitation token invalid or expired.');
  }

  const senderUid = docSnap.data().senderUid;
  const templateParams = {sender: senderUid, receiver: receiverUid};
  const receiverDocsFields = parseDocumentFieldPathList(TARGET_RECEIVER_FIELDS, templateParams);
  const senderDocsFields = parseDocumentFieldPathList(TARGET_SENDER_FIELDS, templateParams);

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
