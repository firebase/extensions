import * as firebase from "firebase-admin";
import * as functions from "firebase-functions";

type Device = {
  deviceId: string;
  fcmToken: string;
  name: string;
  os: string;
  type: "Android" | "iOS" | "Web";
};
type Devices = { [deviceId: string]: Device };
type Notification = {
  android?: firebase.messaging.AndroidConfig;
  apns?: firebase.messaging.ApnsConfig;
  data?: { [key: string]: string };
  notification?: firebase.messaging.Notification;
  userId?: string;
  userIds?: string[];
  webpush?: firebase.messaging.WebpushConfig;
};
type TokenMap = {
  [token: string]: {
    deviceId: string;
    userId: string;
  };
};
type UserDevices = {
  devices: Devices;
  userId: string;
};

firebase.initializeApp();

const devicesPath = process.env.DEVICES_PATH;

export const authusernotifications = functions.handler.firestore.document.onCreate(
  async (snapshot): Promise<void> => {
    const notification: Notification = snapshot.data();
    const { userId, userIds } = notification;
    if (!userId && !userIds) {
      console.warn("Notification is missing a `userId` or `userIds` property");
      return;
    }

    const uIds = userIds || [userId];
    const tokenMap: TokenMap = await loadTokenMap(uIds);
    const tokens: string[] = Object.keys(tokenMap);

    if (tokens.length === 0) {
      console.log(`No tokens were found for users: ${JSON.stringify(uIds)}`);
      return Promise.resolve();
    }

    console.log(
      `Sending notification to ${tokens.length} device(s) for ${
        uIds.length
      } user(s)`
    );

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

      console.log(`Sending notification to batch ${i + 1} of ${batches}`);
      const response = await firebase.messaging().sendMulticast(message);

      response.responses.forEach((response, index) => {
        const { error } = response;
        if (error) {
          // Keep track of the tokens which aren't registered anymore
          if (
            error.code === "messaging/invalid-registration-token" ||
            error.code === "messaging/registration-token-not-registered"
          ) {
            const invalidToken = tokens[index];
            const { deviceId, userId } = tokenMap[invalidToken];
            if (invalidDevices[userId]) {
              invalidDevices[userId].push(deviceId);
            } else {
              invalidDevices[userId] = [deviceId];
            }
            console.log(
              `Removing invalid device: ${deviceId} from userId: ${userId}`
            );
          } else {
            console.error(
              `Failure sending notification to: ${tokens[index]}`,
              error
            );
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
        .collection(devicesPath)
        .doc(userId);
      // @ts-ignore Typescript signature expects the first field path and data to be extracted out
      return ref.update(...updates);
    });

    await Promise.all(promises);
    return;
  }
);

/**
 * Loads the device tokens for every user from Firestore
 */
const loadTokenMap = async (userIds: string[]): Promise<TokenMap> => {
  // Load the snapshots for every user
  const tokenCollection = firebase.firestore().collection(devicesPath);
  const refs = userIds.map((userId) => tokenCollection.doc(userId));
  const snapshots = await firebase.firestore().getAll(...refs);

  // Build up a map of token -> { deviceId, userId } for ease of processing
  const tokenUserIds: TokenMap = {};
  snapshots.forEach((snapshot) => {
    // @ts-ignore Typescript not able to map from DocumentData
    const data: UserDevices = snapshot.data();
    const userId: string = data.userId;
    const devices: Devices = data.devices;
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
