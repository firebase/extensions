### See it in action

You can test out this extension right away!

1.  Go to your [Realtime Database dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/${param:PROJECT_ID}/data) in the Firebase console.

1.  Add a message string to a path that matches the pattern `${param:MESSAGE_PATH}`.

1.  In a few seconds, you'll see a sibling node named `upper` that contains the message in upper case.

### Using the extension

We recommend adding data by pushing -- for example, `firebase.database().ref().push()` -- because pushing assigns an automatically generated ID to the node in the database. During retrieval, these nodes are guaranteed to be ordered by the time they were added. Learn more about reading and writing data for your platform (iOS, Android, or Web) in the [Realtime Database documentation](https://firebase.google.com/docs/database/).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
