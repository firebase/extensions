### See it in action

You can test out this extension right away!

1.  Go to your [Realtime Database dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/${param:PROJECT_ID}/data) in the Firebase console.

1.  In the path `${param:NODE_PATH}`, add more than ${param:MAX_COUNT} child nodes.

1.  In a few seconds, you'll see the number of child nodes reduced to ${param:MAX_COUNT}.

### Using the extension

If the number of nodes in `${param:NODE_PATH}` exceeds the max count of ${param:MAX_COUNT}, this extension deletes the oldest nodes first until there are ${param:MAX_COUNT} nodes remaining.

We recommend adding data via pushing, for example `firebase.database().ref().child('${param:NODE_PATH}').push()`, because pushing assigns an automatically generated ID to the node in the database. During retrieval, these nodes are guaranteed to be ordered by the time they were added. Learn more about reading and writing data for your platform (iOS, Android, or Web) in the [Realtime Database documentation](https://firebase.google.com/docs/database/).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
