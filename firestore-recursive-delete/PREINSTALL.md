This mod creates an HTTPS callable function that the client code can call to recursively delete Cloud Firestore data. A path needs to be provided to the call. If the path represents a collection, then all of its documents and their subcollections will be deleted. If the path represents a document, then that document and all of its subcollections will be deleted.

First, users that are allowed to delete data must have the
`fsdelete` custom claim set to `true`:

```
// See: https://firebase.google.com/docs/auth/admin/custom-claims
admin.auth().setCustomUserClaims(uid, {
  fsdelete: true
}).then(...)
```

Then, the client can call the HTTPS Callable Function with the path parameter specifying the data to delete:

```
// Sample code here is for JavaScript, see https://firebase.google.com/docs/functions/callable
// for syntax for other languages

// 1) Initialize Cloud Functions for Firebase with the correct location:
firebase.app().functions(LOCATION);

// 2) Create and call the function:
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
