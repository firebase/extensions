# auth-user-notifications

**VERSION**: 0.1.0

**DESCRIPTION**: Use Firebase Cloud Messaging to send out notifications whenever a Cloud Firestore document containg the specified content and target user IDs is written to a particular collection. This mod is accompanied by client SDKs for Android, iOS,and Web for managing device tokens in Cloud Firestore.



**CONFIGURATION PARAMETERS:**

* Deployment Location: *Where should the mod be deployed? Pick a location that is close to your Firestore database. See https://firebase.google.com/docs/functions/locations#selecting_regions_for_firestore_and_storage.*

* Notifications Collection Path: *What is the path of the collection containing the FCM messages you would like to send?*

* User Devices Collection Path: *What is the path of the collection containing the user devices?*



**CLOUD FUNCTIONS CREATED:**

* authusernotifications (providers/cloud.firestore/eventTypes/document.create)



**DETAILS**: This mod allows you to send FCM notifications to Firebase Auth users.

The mod creates a Firestore-triggered cloud function that will runs each time a Document is created within a notifications collection that you specify when installing the mod.

This mod works in conjunction with Firebase Device Store which automatically stores the FCM device tokens for every logged in Firebase Auth user.

Check out the following to set up Firebase Device Store in your application:

- [Android SDK](https://github.com/CSFrequency/firebase-device-store-android-sdk)
- [iOS SDK](https://github.com/CSFrequency/firebase-device-store-ios-sdk)
- [Javascript SDK](https://github.com/CSFrequency/firebase-device-store-js-sdk)



**APIS USED**:

* fcm.googleapis.com (Reason: This mod uses FCM to send notifications to users)



**ACCESS REQUIRED**:



This mod will operate with the following project IAM roles:

* datastore.user (Reason: This mod needs to be able to read and write to Firestore which uses Datastore IAM roles)

* firebasenotifications.admin (Reason: This mod needs to be able to send notifications using Firebase Cloud Messaging)
