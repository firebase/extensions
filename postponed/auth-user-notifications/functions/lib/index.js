"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const firebase = require("firebase-admin");
const functions = require("firebase-functions");
firebase.initializeApp();
const devicesPath = process.env.DEVICES_PATH;
exports.authusernotifications = functions.handler.firestore.document.onCreate((snapshot) => __awaiter(this, void 0, void 0, function* () {
    const notification = snapshot.data();
    const { userId, userIds } = notification;
    if (!userId && !userIds) {
        console.warn("Notification is missing a `userId` or `userIds` property");
        return;
    }
    const uIds = userIds || [userId];
    const tokenMap = yield loadTokenMap(uIds);
    const tokens = Object.keys(tokenMap);
    if (tokens.length === 0) {
        console.log(`No tokens were found for users: ${JSON.stringify(uIds)}`);
        return Promise.resolve();
    }
    console.log(`Sending notification to ${tokens.length} device(s) for ${uIds.length} user(s)`);
    const invalidDevices = {};
    // Make sure we only try and send each message to 100 devices at a time
    // as this is the limit that FCM supports
    const batches = Math.ceil(tokens.length / 100);
    for (let i = 0; i < batches; i++) {
        const message = {
            tokens: tokens.slice(i * 100, i * 100 + 100),
            android: notification.android,
            apns: notification.apns,
            data: notification.data,
            notification: notification.notification,
            webpush: notification.webpush,
        };
        console.log(`Sending notification to batch ${i + 1} of ${batches}`);
        const response = yield firebase.messaging().sendMulticast(message);
        response.responses.forEach((response, index) => {
            const { error } = response;
            if (error) {
                // Keep track of the tokens which aren't registered anymore
                if (error.code === "messaging/invalid-registration-token" ||
                    error.code === "messaging/registration-token-not-registered") {
                    const invalidToken = tokens[index];
                    const { deviceId, userId } = tokenMap[invalidToken];
                    if (invalidDevices[userId]) {
                        invalidDevices[userId].push(deviceId);
                    }
                    else {
                        invalidDevices[userId] = [deviceId];
                    }
                    console.log(`Removing invalid device: ${deviceId} from userId: ${userId}`);
                }
                else {
                    console.error(`Failure sending notification to: ${tokens[index]}`, error);
                }
            }
        });
    }
    const promises = Object.keys(invalidDevices).map((userId) => {
        const updates = invalidDevices[userId].reduce((out, deviceId) => {
            out.push(new firebase.firestore.FieldPath("devices", deviceId), firebase.firestore.FieldValue.delete());
            return out;
        }, []);
        const ref = firebase
            .firestore()
            .collection(devicesPath)
            .doc(userId);
        // @ts-ignore Typescript signature expects the first field path and data to be extracted out
        return ref.update(...updates);
    });
    yield Promise.all(promises);
    return;
}));
/**
 * Loads the device tokens for every user from Firestore
 */
const loadTokenMap = (userIds) => __awaiter(this, void 0, void 0, function* () {
    // Load the snapshots for every user
    const tokenCollection = firebase.firestore().collection(devicesPath);
    const refs = userIds.map((userId) => tokenCollection.doc(userId));
    const snapshots = yield firebase.firestore().getAll(...refs);
    // Build up a map of token -> { deviceId, userId } for ease of processing
    const tokenUserIds = {};
    snapshots.forEach((snapshot) => {
        // @ts-ignore Typescript not able to map from DocumentData
        const data = snapshot.data();
        const userId = data.userId;
        const devices = data.devices;
        Object.keys(devices).forEach((deviceId) => {
            const device = devices[deviceId];
            tokenUserIds[device.fcmToken] = {
                deviceId,
                userId,
            };
        });
    });
    return tokenUserIds;
});
