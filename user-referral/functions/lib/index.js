"use strict";
/*
 * Copyright 2018 Google LLC
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const sgMail = require("@sendgrid/mail");
const assertions = require("./assertions");
const config_1 = require("./config");
const httpErrors = require("./errors");
const logs = require("./logs");
admin.initializeApp();
sgMail.setApiKey(config_1.default.sendgridApiKey);
logs.init();
exports.sendInvitation = functions.https.onCall((data, context) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    const { auth } = context;
    assertions.userIsAuthenticated(auth);
    try {
        const { uid } = auth;
        const { email } = data;
        logs.invitationCreating(config_1.default.invitationsCollection);
        const doc = yield admin
            .firestore()
            .collection(config_1.default.invitationsCollection)
            .add({
            senderUid: uid,
            email,
        });
        const { id: token } = doc;
        logs.invitationCreated(config_1.default.invitationsCollection, token);
        const acceptUrl = config_1.default.acceptUrlTemplate.replace("{token}", token);
        logs.invitationSending(acceptUrl);
        yield sendInvitationEmail(email, auth, acceptUrl);
        logs.invitationSent(acceptUrl);
        logs.complete();
        return { acceptUrl };
    }
    catch (err) {
        logs.errorSendInvitation(err);
        throw httpErrors.internal(err);
    }
}));
exports.acceptInvitation = functions.https.onCall((data, context) => __awaiter(this, void 0, void 0, function* () {
    logs.start();
    const { auth } = context;
    assertions.userIsAuthenticated(auth);
    const { uid: receiver } = auth;
    const { token } = data;
    logs.invitationLoading(token);
    const invitationDoc = admin
        .firestore()
        .collection(config_1.default.invitationsCollection)
        .doc(token);
    const snapshot = yield invitationDoc.get();
    assertions.invitationExists(snapshot, token);
    logs.invitationLoaded(token);
    try {
        const { senderUid: sender } = snapshot.data();
        const templateParams = { sender, receiver };
        const receiverDocsFields = parseDocFieldPathList(config_1.default.targetReceiverFields, templateParams);
        const senderDocsFields = parseDocFieldPathList(config_1.default.targetSenderFields, templateParams);
        logs.docPathFieldsUpdating();
        const batch = admin.firestore().batch();
        addDocFieldUpdates(batch, receiverDocsFields, receiver);
        addDocFieldUpdates(batch, senderDocsFields, sender);
        batch.commit();
        logs.docPathFieldsUpdated();
        logs.invitationDeleting(token);
        yield invitationDoc.delete();
        logs.invitationDeleted(token);
        logs.complete();
        return { done: true };
    }
    catch (err) {
        logs.errorAcceptInvitation(err);
        throw httpErrors.internal(err);
    }
}));
const addDocFieldUpdates = (batch, docFields, userId) => __awaiter(this, void 0, void 0, function* () {
    docFields.forEach(({ docPath, field }) => {
        logs.docPathFieldUpdating(docPath, field, userId);
        const ref = admin.firestore().doc(docPath);
        batch.set(ref, {
            [field]: admin.firestore.FieldValue.arrayUnion(userId),
        }, { merge: true });
    });
});
const parseDocFieldPathList = (str, params = {}) => {
    return (str || "")
        .replace(/^\s+|\s+$/g, "")
        .split(/\s*,\s*/)
        .map((s) => {
        let [, docPath, field] = s.match(/(.+)\.(.+)/);
        assertions.docPathFieldValid(docPath, field);
        // hydrate doc path with template params
        docPath = docPath.replace(/\{(.+?)\}/, (s, p) => p in params ? params[p] : s);
        return { docPath, field };
    });
};
const sendInvitationEmail = (email, auth, acceptUrl) => __awaiter(this, void 0, void 0, function* () {
    const emailBodyHtml = `
<p>Hi there ${email},</p>
<p>I'm using ${config_1.default.appName} and I'd love for you to join me! <a href="${acceptUrl}">Accept invitation</a></p>
<p>- ${auth.token.name} (via ${config_1.default.appName})</p>
`;
    const msg = {
        to: email,
        from: config_1.default.sendgridEmailAlias,
        subject: `Join me on ${config_1.default.appName}`,
        html: emailBodyHtml,
    };
    try {
        yield sgMail.send(msg);
    }
    catch (err) {
        // Errors weren't being printed correctly in functions logs.
        throw new Error(JSON.stringify(err, null, 2));
    }
});
