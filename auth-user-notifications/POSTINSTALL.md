You are now set up to send FCM Notifications to your Firebase Auth users.

You'll need to use one of the Firebase Device Store libraries to automatically store device tokens for users of your application:

- [Android SDK](https://github.com/CSFrequency/firebase-device-store-android-sdk)
- [iOS SDK](https://github.com/CSFrequency/firebase-device-store-ios-sdk)
- [Javascript SDK](https://github.com/CSFrequency/firebase-device-store-js-sdk)

To send a notification to one or more users, simply add a document to the collection `${param:NOTIFICATIONS_PATH}`, which follows the structure below.

> For more information, check out the [HTTP v1 FCM API](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages) documentation which is the basis for this Document structure.

```
{
  // The notification can be sent to one of the following options:
  "userId": string,
  "userIds": string[],

  // Shared notification information
  "notification": {
    "title": string,
    "body": string
  },
  // Optional notification data
  "data": {
    "string": string,
    ...
  },
  // Optional Android-specific configuration block
  "android": {
    "collapse_key": string,
    "priority": "NORMAL" | "HIGH",
    "ttl": string,
    "restricted_package_name": string,
    "data": {
      string: string,
      ...
    },
    "notification": {
      "title": string,
      "body": string,
      "icon": string,
      "color": string,
      "sound": string,
      "tag": string,
      "click_action": string,
      "body_loc_key": string,
      "body_loc_args": [
        string
      ],
      "title_loc_key": string,
      "title_loc_args": [
        string
      ],
      "channel_id": string,
    },
  },
  // Optional web-specific configuration task
  "webpush": {
    "headers": {
      string: string,
      ...
    },
    "data": {
      string: string,
      ...
    },
    "notification": {
      object
    },
    "fcm_options": {
      "link": string
    },
  },
  // Optional iOS-specific configuration task
  "apns": {
    "headers": {
      string: string,
      ...
    },
    "payload": {
      object
    },
  },
}
```

The mod will load the User(s)'s device tokens from `${param:DEVICES_PATH}` and send the notification to each of the devices. Invalid or expired tokens will be removed automatically.
