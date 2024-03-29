### See it in action

You can test out this extension right away!

1.  Go to your [Authentication dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/authentication/users) in the Firebase console.

1.  Click **Add User** to add a test user, then copy the test user's UID to your clipboard.

1.  Create a new Cloud Firestore document, a new Realtime Database entry, or upload a new file to Storage - incorporating the user's UID into the path according to the schema that you configured.

1.  Go back to your [Authentication dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/authentication/users), then delete the test user.

1.  In a few seconds, the new data you added above will be deleted from Cloud Firestore, Realtime Database, and/or Storage (depending on what you configured).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
