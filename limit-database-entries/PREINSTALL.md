Use this mod to control the maximum number of items stored in a Firebase Realtime Database path.

If the number of items at your specified Realtime Database path exceeds the specified max count, this mod deletes the oldest items first until there are the max count number of items remaining.

We recommend adding data via pushing, for example `firebase.database().ref().child('posts').push()`, because pushing assigns an automatically generated ID to the item in the database. During retrieval, these items are guaranteed to be ordered by the time they were added. Learn more about reading and writing data for your platform (iOS, Android, or Web) in the [Realtime Database documentation](https://firebase.google.com/docs/database/).
