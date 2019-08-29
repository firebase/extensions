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
const templates = new templates_1.default(admin.firestore().collection(config_1.default.templatesCollection));
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
        if (config_1.default.templatesCollection && payload.template) {
            payload.message = Object.assign(payload.message || {}, yield templates.render(payload.template.name, payload.template.data));
        }
        if (!config_1.default.usersCollection ||
            (!payload.toUids && !payload.ccUids && !payload.bccUids)) {
            return payload;
        }
        const toFetch = {};
        []
            .concat(payload.toUids, payload.ccUids, payload.bccUids)
            .forEach((uid) => (toFetch[uid] = null));
        const docs = yield db.getAll(...Object.keys(toFetch).map((uid) => db.collection(config_1.default.usersCollection).doc(uid)), { fieldMask: ["email"] });
        docs.forEach((doc) => {
            if (doc.exists) {
                toFetch[doc.id] = doc.get("email");
            }
        });
        if (payload.toUids) {
            payload.to = payload.toUids.map((uid) => toFetch[uid]);
            delete payload.toUids;
        }
        if (payload.ccUids) {
            payload.cc = payload.ccUids.map((uid) => toFetch[uid]);
            delete payload.ccUids;
        }
        if (payload.bccUids) {
            payload.bcc = payload.bccUids.map((uid) => toFetch[uid]);
            delete payload.bccUids;
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
