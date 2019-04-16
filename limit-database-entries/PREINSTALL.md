If the number of items at the provided database path exceeds the max count, this function will delete the oldest items first until there are max count items remaining.

It is recommended to add data via pushing, for example: `firebase.database().ref().child('posts').push()`. This is because pushing adds an automatically generated ID to the item in the database, which upon retrieval is guaranteed to be ordered by time added. See 'Read and Write Data' for your platform of choice (e.g. iOS, Android, Web) under [Realtime Database](https://firebase.google.com/docs/database/) documentation.
