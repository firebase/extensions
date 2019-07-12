This mod allows you to send FCM notifications to Firebase Auth users.

The mod creates a Firestore-triggered cloud function that will runs each time a Document is created within a notifications collection that you specify when installing the mod.

This mod works in conjunction with Firebase Device Store which automatically stores the FCM device tokens for every logged in Firebase Auth user.

Check out the following to set up Firebase Device Store in your application:

- [Android SDK](https://github.com/CSFrequency/firebase-device-store-android-sdk)
- [iOS SDK](https://github.com/CSFrequency/firebase-device-store-ios-sdk)
- [Javascript SDK](https://github.com/CSFrequency/firebase-device-store-js-sdk)
