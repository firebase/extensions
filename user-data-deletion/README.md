# Auto-delete user data

**Description**: When a user deletes their account, automatically delete their data from Cloud Firestore, Realtime Database, and/or Cloud Storage.



**Details**: Use this mod to automatically delete a user's data if the user is deleted from your authenticated users.

You can configure this mod to delete user data from any or all of the following: Cloud Firestore, Realtime Database, or Cloud Storage. Note that this mod requires users to be managed by Firebase Authentication because it uses the User ID.

This mod is useful in respecting user privacy and fulfilling compliance requirements. However, using this mod does not guarantee compliance with government and industry regulations.

When you use Firebase Mods, you're only charged for the underlying resources that you use. Firebase Mods themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)




**Configuration Parameters:**

* Deployment location: Where should the mod be deployed? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations#selecting_regions_for_firestore_and_storage).

* Cloud Firestore paths: Which paths in your Cloud Firestore instance contain user data? Leave empty if you don't use Cloud Firestore.
Enter the full paths, separated by commas. You can represent the User ID of the deleted user with `{UID}`.
For example, if you have the collections `users` and `admins`, and each collection has documents with User ID as document IDs, then you can enter `users/{UID},admins/{UID}`.

* Realtime Database paths: Which paths in your Realtime Database instance contain user data? Leave empty if you don't use Realtime Database.
Enter the full paths, separated by commas. You can represent the User ID of the deleted user with `{UID}`.
For example: `users/{UID},admins/{UID}`.

* Cloud Storage paths: Where in Google Cloud Storage do you store user data? Leave empty if you don't use Cloud Storage.
Enter the full paths, separated by commas. You can represent the User ID of the deleted user with `{UID}`. You can use `{DEFAULT}` to represent your default bucket.
For example, if you are using your default bucket, and the bucket has files with the naming scheme `{UID}-pic.png`, then you can enter `{DEFAULT}/{UID}-pic.png`. If you also have files in another bucket called `my-awesome-app-logs`, and that bucket has files with the naming scheme `{UID}-logs.txt`, then you can enter `{DEFAULT}/{UID}-pic.png,my-awesome-app-logs/{UID}-logs.txt`.



**Cloud Functions:**

* **clearData:** Listens for user accounts to be deleted from your project's authenticated users, then removes any associated user data (based on Firebase Authentication's User ID) from Realtime Database, Cloud Firestore, and/or Cloud Storage.



**Access Required**:



This mod will operate with the following project IAM roles:

* datastore.user (Reason: Allows the mod to delete (user) data from Cloud Firestore.)

* firebasedatabase.admin (Reason: Allows the mod to delete (user) data from Realtime Database.)

* storage.admin (Reason: Allows the mod to delete (user) data from Cloud Storage.)
