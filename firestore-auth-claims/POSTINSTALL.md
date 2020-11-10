# Using the extension

This extension will automatically sync data from the `${param:CLAIMS_COLLECTION}` collection to custom claims on a corresponding Firebase Auth user. For example, if I have a user with a UID of `abc123` I could use the Firestore SDK to set custom claims like so:

```js
db.collection("${param:CLAIMS_COLLECTION}")
  .doc("abc123")
  .set({
    role: "admin",
    groups: ["example1", "example2"],
  });
```

Once the document has been written, the extension will automatically set the same custom claims (in this case, `role` and `groups`) on the Firebase Auth user with a UID corresponding to the document ID.

## Integrating with Firebase Rules

While the reasons and methods for setting custom claims vary between applications, in general **you should not allow users to write their own claims**. Because custom claims are useful for authorization, they should only be modified by trusted sources (such as administrators). It is always safe to make claims _readable_ by users since the information is visible in the decoded ID token.

Here's an example set of rules that only allows users with an `admin` role to modify claims, but allows users to read their own:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /${param:CLAIMS_COLLECTION}/{uid} {
      allow read: if request.auth.uid == uid || request.auth.token.role == 'admin';
      allow write: if request.auth.role == 'admin';
    }
  }
}
```

To bootstrap claims management (e.g. create your first `admin`?) you can set claims directly in the Firebase Console, creating a document from your own UID, which you can copy in the Firebase Auth panel.

## Activating new Custom Claims

If custom claims are set interactively in your application for the current user, you may need to refresh the user's ID token to activate them for use in security rules and callable functions. Because the extension writes a `_synced` timestamp field back to the document when claims have been updated, you can listen to the claims document for the current user to receive a realtime signal of a need to refresh:

```js
const currentUser = firebase.auth().currentUser;
firebase
  .firestore()
  .collection("${param:CLAIMS_COLLECTION}")
  .doc(currentUser.uid)
  .onSnapshot(async () => {
    // force a refresh of the ID token, which will pick up new claims
    const tokenResult = await currentUser.getIdTokenResult(true);
  });
```

Note that even without a proactive refresh, custom claims will be updated within an hour.

<!-- We recommend keeping the following section to explain how to monitor extensions with Firebase -->

# Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
