# Delete User Data

**Description**: Deletes data keyed on a userId from Cloud Firestore, Realtime Database, and/or Cloud Storage when a user deletes their account.



**Details**: Use this extension to automatically delete a user's data if the user is deleted from your authenticated users.

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




**Configuration Parameters:**

* Deployment location: Where should the extension be deployed? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Cloud Firestore paths: Which paths in your Cloud Firestore instance contain user data? Leave empty if you don't use Cloud Firestore.
Enter the full paths, separated by commas. You can represent the User ID of the deleted user with `{UID}`.
For example, if you have the collections `users` and `admins`, and each collection has documents with User ID as document IDs, then you can enter `users/{UID},admins/{UID}`.

* Cloud Firestore delete mode: (Only applicable if you use the `Cloud Firestore paths` parameter.) How do you want to delete Cloud Firestore documents? To also delete documents in subcollections, set this parameter to `recursive`.

* Realtime Database paths: Which paths in your Realtime Database instance contain user data? Leave empty if you don't use Realtime Database.
Enter the full paths, separated by commas. You can represent the User ID of the deleted user with `{UID}`.
For example: `users/{UID},admins/{UID}`.

* Cloud Storage paths: Where in Google Cloud Storage do you store user data? Leave empty if you don't use Cloud Storage.
Enter the full paths, separated by commas. You can represent the User ID of the deleted user with `{UID}`. You can use `{DEFAULT}` to represent your default bucket.
For example, if you are using your default bucket, and the bucket has files with the naming scheme `{UID}-pic.png`, then you can enter `{DEFAULT}/{UID}-pic.png`. If you also have files in another bucket called `my-awesome-app-logs`, and that bucket has files with the naming scheme `{UID}-logs.txt`, then you can enter `{DEFAULT}/{UID}-pic.png,my-awesome-app-logs/{UID}-logs.txt`.



**Cloud Functions:**

* **clearData:** Listens for user accounts to be deleted from your project's authenticated users, then removes any associated user data (based on Firebase Authentication's User ID) from Realtime Database, Cloud Firestore, and/or Cloud Storage.



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.owner (Reason: Allows the extension to delete (user) data from Cloud Firestore.)

* firebasedatabase.admin (Reason: Allows the extension to delete (user) data from Realtime Database.)

* storage.admin (Reason: Allows the extension to delete (user) data from Cloud Storage.)
