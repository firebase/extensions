"use strict";
/**
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
const twilio = require("twilio");
const logs = require("./logs");
const config_1 = require("./config");
const templates_1 = require("./templates");
logs.init();
let db;
let transport;
let templates;
let initialized = false;
/**
 * Initializes Admin SDK & SMTP connection if not already initialized.
 */
function initialize() {
    if (initialized === true)
        return;
    initialized = true;
    admin.initializeApp();
    db = admin.firestore();
    transport = twilio(config_1.default.twilioAccountSid, config_1.default.twilioAuthToken);
    if (config_1.default.templatesCollection) {
        templates = new templates_1.default(admin.firestore().collection(config_1.default.templatesCollection));
    }
}
function validateFieldArray(field, array) {
    if (!Array.isArray(array)) {
        throw new Error(`Invalid field "${field}". Expected an array of strings.`);
    }
    if (array.find((item) => typeof item !== "string")) {
        throw new Error(`Invalid field "${field}". Expected an array of strings.`);
    }
}
function processCreate(snap) {
    return __awaiter(this, void 0, void 0, function* () {
        // Wrapping in transaction to allow for automatic retries (#48)
        return admin.firestore().runTransaction((transaction) => {
            transaction.update(snap.ref, {
                delivery: {
                    startTime: admin.firestore.FieldValue.serverTimestamp(),
                    state: "PENDING",
                    attempts: 0,
                    error: null,
                },
            });
            return Promise.resolve();
        });
    });
}
function preparePayload(payload) {
    return __awaiter(this, void 0, void 0, function* () {
        const { template } = payload;
        if (templates && template) {
            if (!template.name) {
                throw new Error(`Template object is missing a 'name' parameter.`);
            }
            payload.message = Object.assign(payload.message || {}, yield templates.render(template.name, template.data));
        }
        if (!payload.toUid) {
            return payload;
        }
        if (!config_1.default.usersCollection) {
            throw new Error("Must specify a users collection to send using uid.");
        }
        payload.to = (yield db.getAll(db.collection(config_1.default.usersCollection).doc(payload.toUid), {
            fieldMask: ["tel"],
        }))[0].get("tel");
        return payload;
    });
}
function deliver(payload, ref) {
    return __awaiter(this, void 0, void 0, function* () {
        logs.attemptingDelivery(ref);
        const update = {
            "delivery.attempts": admin.firestore.FieldValue.increment(1),
            "delivery.endTime": admin.firestore.FieldValue.serverTimestamp(),
            "delivery.error": null,
            "delivery.leaseExpireTime": null,
        };
        try {
            payload = yield preparePayload(payload);
            if (!payload.to) {
                throw new Error("Failed to deliver email. Missing 'to'.");
            }
            const callbackUrl = `https://${config_1.default.location}-${process.env.GCLOUD_PROJECT}.cloudfunctions.net/ext-${process.env.EXT_INSTANCE_ID}-processStatusCallback?msg_id=${ref.id}`;
            console.log(callbackUrl);
            const result = yield transport.messages.create(Object.assign({
                from: config_1.default.defaultFrom,
                smartEncoded: true,
                statusCallback: callbackUrl,
            }, payload.message, { to: payload.to }));
            const info = result.toJSON();
            update["delivery.state"] = result.status.toUpperCase();
            update["delivery.info"] = info;
            logs.delivered(ref, info);
        }
        catch (e) {
            update["delivery.state"] = "ERROR";
            update["delivery.error"] = e.toString();
            logs.deliveryError(ref, e);
        }
        // Wrapping in transaction to allow for automatic retries (#48)
        return admin.firestore().runTransaction((transaction) => {
            transaction.update(ref, update);
            return Promise.resolve();
        });
    });
}
function processWrite(change) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!change.after.exists) {
            return null;
        }
        if (!change.before.exists && change.after.exists) {
            return processCreate(change.after);
        }
        const payload = change.after.data();
        if (!payload.delivery) {
            logs.missingDeliveryField(change.after.ref);
            return null;
        }
        switch (payload.delivery.state) {
            case "SENT":
            case "DELIVERED":
            case "UNDELIVERED":
            case "FAILED":
            case "ERROR":
                return null;
            case "PROCESSING":
            case "QUEUED":
            case "ACCEPTED":
            case "SENDING":
                if (payload.delivery.leaseExpireTime.toMillis() < Date.now()) {
                    // Wrapping in transaction to allow for automatic retries (#48)
                    return admin.firestore().runTransaction((transaction) => {
                        transaction.update(change.after.ref, {
                            "delivery.state": "ERROR",
                            error: "Message processing lease expired.",
                        });
                        return Promise.resolve();
                    });
                }
                return null;
            case "PENDING":
            case "RETRY":
                // Wrapping in transaction to allow for automatic retries (#48)
                yield admin.firestore().runTransaction((transaction) => {
                    transaction.update(change.after.ref, {
                        "delivery.state": "PROCESSING",
                        "delivery.leaseExpireTime": admin.firestore.Timestamp.fromMillis(Date.now() + 60000),
                    });
                    return Promise.resolve();
                });
                return deliver(payload, change.after.ref);
        }
    });
}
exports.processQueue = functions.handler.firestore.document.onWrite((change) => __awaiter(this, void 0, void 0, function* () {
    initialize();
    logs.start();
    try {
        yield processWrite(change);
    }
    catch (err) {
        logs.error(err);
        return null;
    }
    logs.complete();
}));
function isTerminal(state) {
    return ["SENT", "DELIVERED", "FAILED", "UNDELIVERED"].includes(state.toUpperCase());
}
exports.processStatusCallback = functions.handler.https.onRequest((req, res) => __awaiter(this, void 0, void 0, function* () {
    admin.initializeApp();
    db = admin.firestore();
    if (req.body.MessageStatus) {
        const newState = req.body.MessageStatus.toUpperCase();
        yield admin
            .firestore()
            .collection(config_1.default.smsCollection)
            .doc(req.query.msg_id)
            .update({
            "delivery.endTime": isTerminal(newState)
                ? admin.firestore.FieldValue.serverTimestamp()
                : null,
            "delivery.state": newState,
            "delivery.error": req.body.ErrorCode || null,
        });
    }
    console.log(req.query, JSON.stringify(req.body, null, 2));
    res.send("OK");
}));
