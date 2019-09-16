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
const nodemailer = require("nodemailer");
const logs = require("./logs");
const config_1 = require("./config");
const templates_1 = require("./templates");
admin.initializeApp();
const db = admin.firestore();
const transport = nodemailer.createTransport(config_1.default.smtpConnectionUri);
let templates;
if (config_1.default.templatesCollection) {
    templates = new templates_1.default(admin.firestore().collection(config_1.default.templatesCollection));
}
function validateFieldArray(field, array) {
    if (!Array.isArray(array)) {
        throw new Error(`Invalid field "${field}". Expected an array of strings.`);
    }
    for (let i = 0; i < array.length; i++) {
        if (typeof array[i] !== "string") {
            throw new Error(`Invalid field "${field}". Expected an array of strings.`);
        }
    }
}
function processCreate(snap) {
    return __awaiter(this, void 0, void 0, function* () {
        return snap.ref.update({
            delivery: {
                startTime: admin.firestore.FieldValue.serverTimestamp(),
                state: "PENDING",
                attempts: 0,
                error: null,
            },
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
        let to = [];
        let cc = [];
        let bcc = [];
        let uids = [];
        if (payload.to) {
            validateFieldArray("to", payload.to);
            to = [...to, ...payload.to];
        }
        if (payload.cc) {
            validateFieldArray("cc", payload.cc);
            cc = [...cc, ...payload.cc];
        }
        if (payload.bcc) {
            validateFieldArray("bcc", payload.bcc);
            bcc = [...bcc, ...payload.bcc];
        }
        if (!payload.toUids && !payload.ccUids && !payload.bccUids) {
            payload.to = to;
            payload.cc = cc;
            payload.bcc = bcc;
            return payload;
        }
        if (payload.toUids && config_1.default.usersCollection) {
            validateFieldArray("toUids", payload.toUids);
            uids = [...uids, ...payload.toUids];
        }
        else if (payload.toUids && !config_1.default.usersCollection) {
            throw new Error(`'toUids' were provided, but no User collection was provided.`);
        }
        if (payload.ccUids && config_1.default.usersCollection) {
            validateFieldArray("ccUids", payload.ccUids);
            uids = [...uids, ...payload.ccUids];
        }
        else if (payload.ccUids && !config_1.default.usersCollection) {
            throw new Error(`'ccUids' were provided, but no User collection was provided.`);
        }
        if (payload.bccUids && config_1.default.usersCollection) {
            validateFieldArray("bccUids", payload.bccUids);
            uids = [...uids, ...payload.bccUids];
        }
        else if (payload.bccUids && !config_1.default.usersCollection) {
            throw new Error(`'bccUids' were provided, but no User collection was provided.`);
        }
        const documents = yield db.getAll(...uids.map((uid) => db.collection(config_1.default.usersCollection).doc(uid)), {
            fieldMask: ["email"],
        });
        const userMap = {};
        documents.forEach((documentSnapshot) => {
            if (documentSnapshot.exists) {
                const email = documentSnapshot.get("email");
                if (email) {
                    userMap[documentSnapshot.id] = email;
                }
            }
        });
        if (payload.toUids) {
            const toUidsEmails = payload.toUids.map((uid) => userMap[uid]);
            payload.to = [...to, ...toUidsEmails];
        }
        if (payload.ccUids) {
            const ccUidsEmails = payload.ccUids.map((uid) => userMap[uid]);
            payload.cc = [...cc, ...ccUidsEmails];
        }
        if (payload.bccUids) {
            const bccUidsEmails = payload.bccUids.map((uid) => userMap[uid]);
            payload.bcc = [...cc, ...bccUidsEmails];
        }
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
            if (!payload.to.length && !payload.cc.length && !payload.bcc.length) {
                throw new Error("Failed to deliver email. Expected at least 1 recipient.");
            }
            const result = yield transport.sendMail(Object.assign(payload.message, {
                from: payload.from || config_1.default.defaultFrom,
                replyTo: payload.replyTo || config_1.default.defaultReplyTo,
                to: payload.to,
                cc: payload.cc,
                bcc: payload.bcc,
            }));
            const info = {
                messageId: result.messageId || null,
                accepted: result.accepted || [],
                rejected: result.rejected || [],
                pending: result.pending || [],
                response: result.response || null,
            };
            update["delivery.state"] = "SUCCESS";
            update["delivery.info"] = info;
            logs.delivered(ref, info);
        }
        catch (e) {
            update["delivery.state"] = "ERROR";
            update["delivery.error"] = e.toString();
            logs.deliveryError(ref, e);
        }
        return ref.update(update);
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
            case "SUCCESS":
            case "ERROR":
                return null;
            case "PROCESSING":
                if (payload.delivery.leaseExpireTime.toMillis() < Date.now()) {
                    return change.after.ref.update({
                        "delivery.state": "ERROR",
                        error: "Message processing lease expired.",
                    });
                }
                return null;
            case "PENDING":
            case "RETRY":
                yield change.after.ref.update({
                    "delivery.state": "PROCESSING",
                    "delivery.leaseExpireTime": admin.firestore.Timestamp.fromMillis(Date.now() + 60000),
                });
                return deliver(payload, change.after.ref);
        }
    });
}
exports.processQueue = functions.handler.firestore.document.onWrite((change) => __awaiter(this, void 0, void 0, function* () {
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
