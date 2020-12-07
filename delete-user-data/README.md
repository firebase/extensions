# Delete User Data

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Deletes data keyed on a userId from Cloud Firestore, Realtime Database, and/or Cloud Storage when a user deletes their account.



**Details**: Use this extension to automatically delete a user's data if the user is deleted from your authenticated users.

You can configure this extension to delete user data from any or all of the following: Cloud Firestore, Realtime Database, or Cloud Storage. Each trigger of the extension to delete data is keyed to the user's UserId.

**Note:** To use this extension, you need to manage your users with Firebase Authentication.

This extension is useful in respecting user privacy and fulfilling compliance requirements. However, using this extension does not guarantee compliance with government and industry regulations.

#### Additional setup

Depending on where you'd like to delete user data from, make sure that you've set up [Cloud Firestore](https://firebase.google.com/docs/firestore), [Realtime Database](https://firebase.google.com/docs/database), or [Cloud Storage](https://firebase.google.com/docs/storage) in your Firebase project before installing this extension.

Also, make sure that you've set up [Firebase Authentication](https://firebase.google.com/docs/auth) to manage your users.

#### Billing
 
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)
 
- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s free tier:
  - Cloud Firestore
  - Firebase Realtime Database
  - Cloud Storage
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#expandable-24))




**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension?  You usually want a location close to your database or Storage bucket. For help selecting a location, refer to the [location selection  guide](https://firebase.google.com/docs/functions/locations).

* Cloud Firestore paths: Which paths in your Cloud Firestore instance contain user data? Leave empty if you don't use Cloud Firestore.
Enter the full paths, separated by commas. You can represent the User ID of the deleted user with `{UID}`.
For example, if you have the collections `users` and `admins`, and each collection has documents with User ID as document IDs, then you can enter `users/{UID},admins/{UID}`.

* Cloud Firestore delete mode: (Only applicable if you use the `Cloud Firestore paths` parameter.) How do you want to delete Cloud Firestore documents? To also delete documents in subcollections, set this parameter to `recursive`.

* Realtime Database instance: From which Realtime Database instance do you want to delete user data?


* Realtime Database paths: Which paths in your Realtime Database instance contain user data? Leave empty if you don't use Realtime Database.
Enter the full paths, separated by commas. You can represent the User ID of the deleted user with `{UID}`.
For example: `users/{UID},admins/{UID}`.

* Cloud Storage paths: Where in Google Cloud Storage do you store user data? Leave empty if you don't use Cloud Storage.
Enter the full paths to files or directories in your Storage buckets, separated by commas. Use `{UID}` to represent the User ID of the deleted user, and use `{DEFAULT}` to represent your default Storage bucket.
Here's a series of examples. To delete all the files in your default bucket with the file naming scheme `{UID}-pic.png`, enter `{DEFAULT}/{UID}-pic.png`. To also delete all the files in another bucket called my-app-logs with the file naming scheme `{UID}-logs.txt`, enter `{DEFAULT}/{UID}-pic.png,my-app-logs/{UID}-logs.txt`. To *also* delete a User ID-labeled directory and all its files (like `media/{UID}`), enter `{DEFAULT}/{UID}-pic.png,my-app-logs/{UID}-logs.txt,{DEFAULT}/media/{UID}`.



**Cloud Functions:**

* **clearData:** Listens for user accounts to be deleted from your project's authenticated users, then removes any associated user data (based on Firebase Authentication's User ID) from Realtime Database, Cloud Firestore, and/or Cloud Storage.



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.owner (Reason: Allows the extension to delete (user) data from Cloud Firestore.)

* firebasedatabase.admin (Reason: Allows the extension to delete (user) data from Realtime Database.)

* storage.admin (Reason: Allows the extension to delete (user) data from Cloud Storage.)
