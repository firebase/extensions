Use this extension to automatically delete a user's data if the user is deleted from your authenticated users.

You can configure this extension to delete user data from any or all of the following: Cloud Firestore, Realtime Database, or Cloud Storage. Each trigger of the extension to delete data is keyed to the user's UserId.

**Note:** To use this extension, you need to manage your users with Firebase Authentication.

This extension is useful in respecting user privacy and fulfilling compliance requirements. However, using this extension does not guarantee compliance with government and industry regulations.

#### Additional setup

Depending on where you'd like to delete user data from, make sure that you've set up [Cloud Firestore](https://firebase.google.com/docs/firestore), [Realtime Database](https://firebase.google.com/docs/database), or [Cloud Storage](https://firebase.google.com/docs/storage) in your Firebase project before installing this extension.

Also, make sure that you've set up [Firebase Authentication](https://firebase.google.com/docs/auth) to manage your users.

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:
- Cloud Firestore
- Firebase Realtime Database
- Cloud Storage
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
