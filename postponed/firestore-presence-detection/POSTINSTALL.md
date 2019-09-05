### See it in action

To test out this extension, follow these steps:

1.  Go to RTDB and Firestore tab

1.  Create the document in RTDB (TODO define path)

1.  Insert a dummy session/user at the document path (e.g. `user0: {sessions: {session: true}}`). The key defined at `user0/sessions/` will be the ID for the session and all data at that node is considered to be metadata. Instead of inserting `true`, try putting in data of your own!

1.  In a few seconds, the collection will be created in the Firestore collection (TODO collection here) with the mirrored information.

### Using the extension

// TODO define function, location, trigger. Define RTDB location and Firestore location

// TODO define how to use the extension (i.e. use the SDK). 
1. How to use `SessionManager`
1. How to use `setMetadata`
1. Anything else to know?

// TODO define how to clean up stale connections

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.