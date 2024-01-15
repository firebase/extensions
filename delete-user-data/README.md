# Delete User Data

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Deletes data keyed on a userId from Cloud Firestore, Realtime Database, or Cloud Storage when a user deletes their account.



**Details**: Use this extension to automatically delete certain data keyed on a user ID when the user is deleted from Firebase Authentication.

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




**Configuration Parameters:**

* Cloud Firestore paths: Which paths in your Cloud Firestore instance contain data keyed on a user ID? Leave empty if you don't use Cloud Firestore.
Enter the full paths, separated by commas. Use `{UID}` as a placeholder for the user's UID.
For example, if you have the collections `users` and `admins`, and each collection has documents with User ID as document IDs, then enter `users/{UID},admins/{UID}`.

* Cloud Firestore delete mode: (Only applicable if you use the `Cloud Firestore paths` parameter.) How do you want to delete Cloud Firestore documents? To also delete documents in subcollections, set this parameter to `recursive`.

* Realtime Database instance: What is the ID of the Realtime Database instance from which you want to delete user data (keyed on user ID)?


* Realtime Database location: (Only applicable if you provided the `Realtime Database instance` parameter.) From which Realtime Database location do you want to delete data keyed on a user ID?


* Realtime Database paths: Which paths in your Realtime Database instance contain data keyed on a user ID? Leave empty if you don't use Realtime Database.
Enter the full paths, separated by commas. Use `{UID}` as a placeholder for the user's UID.
For example: `users/{UID},admins/{UID}`.

* Cloud Storage bucket: Which Google Cloud Storage bucket do you want to delete files from?


* Cloud Storage paths: Where in Google Cloud Storage do you store data keyed on a user ID? Leave empty if you don't use Cloud Storage.
Enter the full paths to files or directories in your Storage buckets, separated by commas. Use `{UID}` to represent the User ID of the deleted user, and use `{DEFAULT}` to represent your default Storage bucket.
Here's a series of examples. To delete all the files in your default bucket with the file naming scheme `{UID}-pic.png`, enter `{DEFAULT}/{UID}-pic.png`. To also delete all the files in another bucket called my-app-logs with the file naming scheme `{UID}-logs.txt`, enter `{DEFAULT}/{UID}-pic.png,my-app-logs/{UID}-logs.txt`. To *also* delete a User ID-labeled directory and all its files (like `media/{UID}`), enter `{DEFAULT}/{UID}-pic.png,my-app-logs/{UID}-logs.txt,{DEFAULT}/media/{UID}`.

* Enable auto discovery: Enable the extension to automatically discover Firestore collections and documents to delete.

* Auto discovery search depth: If auto discovery is enabled, how deep should auto discovery find collections and documents. For example, setting to `1` would only discover root collections and documents, whereas setting to `9` would search sub-collections 9 levels deep. Defaults to `3`.

* Auto discovery search fields: If auto discovery is enabled, specify what document fields are used to associate the UID with the document. The extension will delete documents where the value for one or more of these fields matches the deleting user’s UID. If left empty, document fields will not be used in auto discovery.

* Search function URL: Specify a URL to call that will return a list of document paths to delete. The extension will send a `POST` request to the specified `URL`, with the `uid` of the deleted user will be provided in the body of the request. The endpoint specified should return an array of firestore paths to delete.



**Cloud Functions:**

* **clearData:** Listens for user accounts to be deleted from your project's authenticated users, then removes any associated user data (based on Firebase Authentication's User ID) from Realtime Database, Cloud Firestore, and/or Cloud Storage.

* **handleSearch:** undefined

* **handleDeletion:** undefined



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.owner (Reason: Allows the extension to delete (user) data from Cloud Firestore.)

* firebasedatabase.admin (Reason: Allows the extension to delete (user) data from Realtime Database.)

* storage.admin (Reason: Allows the extension to delete (user) data from Cloud Storage.)

* pubsub.admin (Reason: Allows the extension to publish and subscribe to PubSub events. The extension uses PubSub to parallelize deletion and data discovery, no PubSub data is deleted.)
