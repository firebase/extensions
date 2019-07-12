"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    acceptUrlTemplate: process.env.ACCEPT_URL_TEMPLATE,
    appName: process.env.APP_NAME,
    invitationsCollection: process.env.METADATA_FIRESTORE_COLLECTION,
    sendgridEmailAlias: process.env.SENDGRID_EMAIL_ALIAS,
    sendgridApiKey: process.env.SENDGRID_API_KEY,
    targetReceiverFields: process.env.TARGET_RECEIVER_FIELDS,
    targetSenderFields: process.env.TARGET_SENDER_FIELDS,
};
