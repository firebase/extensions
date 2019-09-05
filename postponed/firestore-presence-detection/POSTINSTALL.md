### See it in action

To test out this extension, follow these steps:

1.  Navigate to [RTDB](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/data) and [Cloud Firestore](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data) tab.

1.  In RTDB, Create the document using the path you specified in the extension setup: `${param:RTDB_PATH}`

1.  Insert a dummy session/user at the document path (e.g. `user0: {sessions: {session0: true}}`). The key defined at `${param:RTDB_PATH}/user0/sessions/` (i.e. `session0`) is the ID for a particular session and all data at that node is considered to be metadata. Instead of inserting `true`, try putting in data of your own!

1.  In a few seconds, the collection will be created in the Firestore collection `${param:FIRESTORE_PATH}` with the mirrored information. Note that IAM permissions may take a minute to propagate the permissions for the Cloud function to work properly.

1.  To simulate a user logging off of the session, you can delete the document `${param:RTDB_PATH}/user0/sessions/session0`. The corresponding session in Firestore should be deleted shortly after.

### Using the extension

// TODO define function, location, trigger. Define RTDB location and Firestore location (nguymichael@)

// TODO define how to use the extension (i.e. use the SDK). (yuchenshi@)
1. How to use `SessionManager`
1. How to use `setMetadata`
1. Anything else to know?

// TODO define how to clean up stale connections

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.