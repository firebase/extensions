Use this mod to recursively delete Cloud Firestore data.

This mod creates an HTTPS-callable function that you can call in the client code to recursively delete data from a specified Cloud Firestore path. If the path represents a collection, then all of its documents and their subcollections will be deleted. If the path represents a document, then that document and all of its subcollections will be deleted.

To use this mod, you need to configure the following:

First, users that are allowed to delete data must have the `fsdelete` custom claim set to `true`:

```
// Refer to: https://firebase.google.com/docs/auth/admin/custom-claims
admin.auth().setCustomUserClaims(uid, {
  fsdelete: true
}).then(...)
```

Then, the client can call the HTTPS-callable function with the path parameter that specifies the data to delete.

Note that the sample code here is for JavaScript. Refer to the [Cloud Functions for Firebase documentation](https://firebase.google.com/docs/functions/callable) for syntax of other languages.

```
// Initialize Cloud Functions for Firebase with the desired location:
firebase.app().functions(LOCATION);

// Create and call the function:
const deleteFn = firebase.functions().httpsCallable(FUNCTION_NAME);
deleteFn({
  path: '/widgets/foo123/orders'
}).then((result) => {
  // Delete success!
  // ...
}).catch((err) => {
  // Delete failed.
  // ...
});
```
