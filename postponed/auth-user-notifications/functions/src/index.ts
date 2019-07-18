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

import * as firebase from "firebase-admin";
import * as functions from "firebase-functions";

import config from "./config";
import * as logs from "./logs";
import { Notification, TokenMap, UserDevices } from "./types";

// Initialize the Firebase Admin SDK
firebase.initializeApp();

logs.init();

export const authusernotifications = functions.handler.firestore.document.onCreate(
  async (snapshot): Promise<void> => {
    logs.start();

    try {
      const notification: Notification = snapshot.data();
      const { userId, userIds } = notification;
      if (!userId && !userIds) {
        logs.userMissing();
        return;
      }

      const uIds = userIds || [userId];

      logs.tokensLoading(uIds);
      const tokenMap = await loadTokenMap(uIds);
      const tokens = Object.keys(tokenMap);
      logs.tokensLoaded(uIds);

      if (tokens.length === 0) {
        logs.tokensNotFound(uIds);
        return;
      }

      logs.notificationSending(uIds, tokens);

      const invalidDevices: { [userId: string]: string[] } = {};

      // Make sure we only try and send each message to 100 devices at a time
      // as this is the limit that FCM supports
      const batches = Math.ceil(tokens.length / 100);
      for (let i = 0; i < batches; i++) {
        const message: firebase.messaging.MulticastMessage = {
          tokens: tokens.slice(i * 100, i * 100 + 100),
          android: notification.android,
          apns: notification.apns,
          data: notification.data,
          notification: notification.notification,
          webpush: notification.webpush,
        };

        logs.notificationBatchSending(i + 1, batches);
        const response = await firebase.messaging().sendMulticast(message);
        logs.notificationBatchSent(i + 1, batches);

        response.responses.forEach((response, index) => {
          const { error } = response;
          if (error) {
            const invalidToken = tokens[index];
            const { deviceId, userId } = tokenMap[invalidToken];
            // Keep track of the tokens which aren't registered anymore
            if (
              error.code === "messaging/invalid-registration-token" ||
              error.code === "messaging/registration-token-not-registered"
            ) {
              if (invalidDevices[userId]) {
                invalidDevices[userId].push(deviceId);
              } else {
                invalidDevices[userId] = [deviceId];
              }
              logs.deviceInvalid(userId, deviceId);
            } else {
              logs.notificationError(userId, deviceId, error);
            }
          }
        });
      }

      const promises = Object.keys(invalidDevices).map((userId) => {
        const updates = invalidDevices[userId].reduce((out, deviceId) => {
          out.push(
            new firebase.firestore.FieldPath("devices", deviceId),
            firebase.firestore.FieldValue.delete()
          );
          return out;
        }, []);

        const ref = firebase
          .firestore()
          .collection(config.devicesPath)
          .doc(userId);
        // @ts-ignore Typescript signature expects the first field path and data to be extracted out
        return ref.update(...updates);
      });

      logs.invalidDevicesRemoving();
      await Promise.all(promises);
      logs.invalidDevicesRemoved();

      logs.complete();
    } catch (err) {
      logs.error(err);
    }
  }
);

/**
 * Loads the device tokens for every user from Firestore
 */
const loadTokenMap = async (userIds: string[]): Promise<TokenMap> => {
  // Load the snapshots for every user
  const tokenCollection = firebase.firestore().collection(config.devicesPath);
  const refs = userIds.map((userId) => tokenCollection.doc(userId));
  const snapshots = await firebase.firestore().getAll(...refs);

  // Build up a map of token -> { deviceId, userId } for ease of processing
  const tokenUserIds: TokenMap = {};
  snapshots.forEach((snapshot) => {
    // @ts-ignore Typescript not able to map from DocumentData
    const data: UserDevices = snapshot.data();
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
};
