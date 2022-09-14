### See it in action

You can test out this extension right away!

1.  Go to your [Authentication dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/authentication/users) in the Firebase console.

1.  Click **Add User** to add a test user, then copy the test user's UID to your clipboard.

1.  Create a new Cloud Firestore document, a new Realtime Database entry, or upload a new file to Storage - incorporating the user's UID into the path according to the schema that you configured.

1.  Go back to your [Authentication dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/authentication/users), then delete the test user.

1.  In a few seconds, the new data you added above will be deleted from Cloud Firestore, Realtime Database, and/or Storage (depending on what you configured).

### Using the extension

When a user's account is deleted from your project's authenticated users, this extension automatically deletes their data from Cloud Firestore, Realtime Database, and/or Cloud Storage.

* Cloud Firestore path(s): `${param:FIRESTORE_PATHS}`
* Realtime Database path(s): `${param:RTDB_PATHS}`
* Cloud Storage path(s): `${param:STORAGE_PATHS}`
* Database Instance path(s): `${param:SELECTED_DATABASE_INSTANCE}`

You can delete a user directly in your [Authentication dashboard]((https://console.firebase.google.com/project/${param:PROJECT_ID}/authentication/users)) or by using one of the Firebase Authentication SDKs. Learn more in the [Authentication documentation](https://firebase.google.com/docs/auth).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
