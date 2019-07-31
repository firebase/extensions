### See it in action

To test out this mod, follow these steps:

1.  Go to the [Realtime Database tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/${param:PROJECT_ID}/data).

1.  In the path `${param:NODE_PATH}`, add more than ${param:MAX_COUNT} child nodes.

1.  In a few seconds, you'll see the number of child nodes reduced to ${param:MAX_COUNT}.

### Using the mod

If the number of nodes in `${param:NODE_PATH}` exceeds the max count of `${param:MAX_COUNT}`, this mod deletes the oldest nodes first until there are `${param:MAX_COUNT}` nodes remaining.

We recommend adding data via pushing, for example `firebase.database().ref().child('${param:NODE_PATH}').push()`, because pushing assigns an automatically generated ID to the node in the database. During retrieval, these nodes are guaranteed to be ordered by the time they were added. Learn more about reading and writing data for your platform (iOS, Android, or Web) in the [Realtime Database documentation](https://firebase.google.com/docs/database/).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/mods/manage-installed-mods#monitor) of your installed mod, including checks on its health, usage, and logs.
