### See it in action

To test out this extension, follow these steps:

1.  Navigate to [RTDB](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/data) and [Cloud Firestore](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data) tab.

1.  In RTDB, Create the document using the path you specified in the extension setup: `${param:RTDB_PATH}`

1.  Insert a dummy session/user at the document path (e.g. `user0: {sessions: {session0: true}}`). The key defined at `${param:RTDB_PATH}/user0/sessions/` (i.e. `session0`) is the ID for a particular session and all data at that node is considered to be metadata. Instead of inserting `true`, try putting in data of your own!

1.  In a few seconds, the collection will be created in the Firestore collection `${param:FIRESTORE_PATH}` with the mirrored information. Note that IAM permissions may take a minute to propagate the permissions for the Cloud function to work properly.

1.  To simulate a user logging off of the session, you can delete the document `${param:RTDB_PATH}/user0/sessions/session0`. The corresponding session in Firestore should be deleted shortly after.

### Using the extension

#### Client SDK

First, [download](./sample-app/public/firebase-presence.js) the JavaScript SDK and include it on the web page:

```html
    <script src="/firebase-presence.js"></script>
```

Then, initialize the Presence SDK using JavaScript after:

```javascript
  var rtdbRef = firebase.database().ref('${param:RTDB_PATH}');
  var sessionManager = new firebasePresence.SessionManager(firebase.auth(), rtdbRef);
```

After user sign-in, call `sessionManager.goOnline()` to start tracking presence. The code snippet below uses a Anonymous Auth, but the SDK works with any sign-in method supported by Firebase Auth. Just don't forget to call `sessionManager.goOnline()` after the sign-in logic.

```javascript
  // TODO: Replace signInAnonymously() accordingly to your app.
  firebase.auth().signInAnonymously().then(function () {
    // Then tell sessionManager to create sessions for the user.
    // sessionManager automatically tracks disconnection and reconnection.
    sessionManager.goOnline();
  });
```

BEFORE user sign-out, make sure to call `sessionManager.goOffline()`.

```javascript
  sessionManager.goOffline().then(function () {
    // AFTER that, sign the user out from Firebase Auth.
    // The ordering is important for things to be properly cleaned up.
    return firebase.auth().signOut();
  }).then(function () {
    console.log("We're fully logged out!");
  });
```

And that's it! The presence should be automatically mirrored to Firestore, under the collection `${param:FIRESTORE_PATH}`. Each document there represents the presence status of one user. The document key is the User ID.
Users who are online will have a non-empty `sessions` field. (Note that users who never come online may not have a presence document in Firestore.)

For example, to query for ALL online users, the following query can be used:

```javascript
  app.firestore().collection('${param:FIRESTORE_PATH}')
    .where('sessions', '>', {})
    .onSnapshot(function (snap) {
      // Do something with snap.docs() ...
      // Please see the sample app for more information on accessing the session details.
    });
```

For more information, please see the [sample app](./sample-app/public/index.html), which contains detailed description on how to use the extension.

#### Advanced: Track session metadata

Optionally, you can also associate some metadata to the sessions via:

```javascript
sessionManager.setMetadata({foo: 'bar'});
```

The data will be automatically deleted when a session ends (i.e. when this client goes offline). And when the client reconnects, the SDK will automaticallly create a new session with the same metadata. Metadata can be changed at any time by calling `setMetadata` again.

#### RTDB Security Rules

Secure read/writes to RTDB with security rules. Using the document path `${param:RTDB_PATH}`, you want to copy and paste the following:

```json
"$user_uid": {
  ".read": "auth.uid == $user_uid",
  ".write": "auth.uid == $user_uid",
 }
```

This will only allow admins and authenticated users whose UUID matches the document key to read/write the location.

#### Cleanup

To cleanup tombstones (see "Preinstall"), publish a message to the topic `${param:PUBSUB_TOPIC}` to trigger the Cloud function. This can be done [programatically](https://cloud.google.com/pubsub/docs/publisher), manually through the [Cloud Console](https://cloud.google.com/pubsub/docs/quickstart-console#publish_a_message_to_the_topic), or automatically by using [Cloud Scheduler](https://cloud.google.com/scheduler/docs/tut-pub-sub) to schedule the cleanup to run periodically. The topic is created when the extension is installed so there is no need for setup.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
