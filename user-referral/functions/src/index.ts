/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import * as sgMail from "@sendgrid/mail";

import * as assertions from "./assertions";
import config from "./config";
import * as httpErrors from "./errors";
import * as logs from "./logs";

admin.initializeApp();
sgMail.setApiKey(config.sendgridApiKey);

logs.init();

export const sendInvitation = functions.https.onCall(async (data, context) => {
  logs.start();

  const { auth } = context;
  assertions.userIsAuthenticated(auth);

  try {
    const { uid } = auth;
    const { email } = data;

    logs.invitationCreating(config.invitationsCollection);
    const doc = await admin
      .firestore()
      .collection(config.invitationsCollection)
      .add({
        senderUid: uid,
        email,
      });
    const { id: token } = doc;
    logs.invitationCreated(config.invitationsCollection, token);

    const acceptUrl = config.acceptUrlTemplate.replace("{token}", token);

    logs.invitationSending(acceptUrl);
    await sendInvitationEmail(email, auth, acceptUrl);
    logs.invitationSent(acceptUrl);

    logs.complete();
    return { acceptUrl };
  } catch (err) {
    logs.errorSendInvitation(err);
    throw httpErrors.internal(err);
  }
});

export const acceptInvitation = functions.https.onCall(
  async (data, context) => {
    logs.start();

    const { auth } = context;
    assertions.userIsAuthenticated(auth);

    const { uid: receiver } = auth;
    const { token } = data;

    logs.invitationLoading(token);
    const invitationDoc = admin
      .firestore()
      .collection(config.invitationsCollection)
      .doc(token);
    const snapshot = await invitationDoc.get();
    assertions.invitationExists(snapshot, token);
    logs.invitationLoaded(token);

    try {
      const { senderUid: sender } = snapshot.data();
      const templateParams = { sender, receiver };
      const receiverDocsFields = parseDocFieldPathList(
        config.targetReceiverFields,
        templateParams
      );
      const senderDocsFields = parseDocFieldPathList(
        config.targetSenderFields,
        templateParams
      );

      logs.docPathFieldsUpdating();
      const batch = admin.firestore().batch();
      addDocFieldUpdates(batch, receiverDocsFields, receiver);
      addDocFieldUpdates(batch, senderDocsFields, sender);
      batch.commit();
      logs.docPathFieldsUpdated();

      logs.invitationDeleting(token);
      await invitationDoc.delete();
      logs.invitationDeleted(token);

      logs.complete();
      return { done: true };
    } catch (err) {
      logs.errorAcceptInvitation(err);
      throw httpErrors.internal(err);
    }
  }
);

const addDocFieldUpdates = async (
  batch: admin.firestore.WriteBatch,
  docFields: any[],
  userId: string
) => {
  docFields.forEach(({ docPath, field }) => {
    logs.docPathFieldUpdating(docPath, field, userId);
    const ref = admin.firestore().doc(docPath);
    batch.set(
      ref,
      {
        [field]: admin.firestore.FieldValue.arrayUnion(userId),
      },
      { merge: true }
    );
  });
};

const parseDocFieldPathList = (str, params = {}) => {
  return (str || "")
    .replace(/^\s+|\s+$/g, "")
    .split(/\s*,\s*/)
    .map((s) => {
      let [, docPath, field] = s.match(/(.+)\.(.+)/);
      assertions.docPathFieldValid(docPath, field);

      // hydrate doc path with template params
      docPath = docPath.replace(/\{(.+?)\}/, (s, p) =>
        p in params ? params[p] : s
      );

      return { docPath, field };
    });
};

const sendInvitationEmail = async (
  email: string,
  auth,
  acceptUrl: string
): Promise<void> => {
  const emailBodyHtml = `
<p>Hi there ${email},</p>
<p>I'm using ${
    config.appName
  } and I'd love for you to join me! <a href="${acceptUrl}">Accept invitation</a></p>
<p>- ${auth.token.name} (via ${config.appName})</p>
`;

  const msg = {
    to: email,
    from: config.sendgridEmailAlias,
    subject: `Join me on ${config.appName}`,
    html: emailBodyHtml,
  };

  try {
    await sgMail.send(msg);
  } catch (err) {
    // Errors weren't being printed correctly in functions logs.
    throw new Error(JSON.stringify(err, null, 2));
  }
};
