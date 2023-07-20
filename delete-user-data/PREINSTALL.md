Use this extension to automatically delete certain data keyed on a user ID when the user is deleted from Firebase Authentication.

You can configure this extension to delete certain data keyed on a user ID from any or all of the following: Cloud Firestore, Realtime Database, or Cloud Storage. Each trigger of the extension to delete data is keyed to the user's UID.

This extension has a few different mechanisms for discovering data keyed on a user ID for deletion that you can configure during installation. These are outlined in the [official docs](https://firebase.google.com/docs/extensions/official/delete-user-data) for this extension. The extension will only delete data that it is explicitly configured to delete based on the mechanisms provided.

To use this extension, you need to manage your users with Firebase Authentication.

**NOTE: This extension may be useful in helping you respect user privacy and fulfill compliance requirements you may be subject to. However, you are responsible for assessing and determining your compliance needs and obligations, and using this extension does not guarantee compliance with government and industry regulations.**

#### Additional setup

Depending on where you'd like to delete user data from, make sure that you've set up [Cloud Firestore](https://firebase.google.com/docs/firestore), [Realtime Database](https://firebase.google.com/docs/database), or [Cloud Storage](https://firebase.google.com/docs/storage) in your Firebase project before installing this extension.

Also, make sure that you've set up [Firebase Authentication](https://firebase.google.com/docs/auth) to manage your users.

#### Billing
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)
 
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
  - Cloud Firestore
  - Firebase Realtime Database
  - Cloud Storage
  - Pubsub
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))
