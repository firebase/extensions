### See it in action

To test out this extension, follow these steps:

1.  Go to the [Authentication tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/authentication/users).

1.  Click "Add User" to add a test user.

1.  Copy the User UID onto your clipboard.

1.  Create a new Realtime Database entry, a new Cloud Firestore document, or upload a new file to Storage - incorporating the User UID into the path according to the schema that you configured.

1.  Go back to the [Authentication tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/authentication/users) and delete the test user.

1.  In a few seconds, their data will be deleted from Realtime Database, Cloud Firestore, and/or Storage depending on what you configured.

### Using the extension

When a user's account is deleted from your project's authenticated users, their data will be automatically deleted from your specified Cloud Firestore instance, Realtime Database instance, and/or Cloud Storage bucket.

You can delete a user using the [Authentication Tab]((https://console.firebase.google.com/project/${param:PROJECT_ID}/authentication/users)) or using one of our SDKs. Learn more in the [Authentication documentation](https://firebase.google.com/docs/auth).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
