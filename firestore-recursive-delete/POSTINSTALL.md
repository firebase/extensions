This mod creates an HTTPS-callable function (`${function:fsdelete.name}`) that you can call in the client code to recursively delete data from a specified Cloud Firestore path.

To start using this installed mod, you need to configure the following:

First, users that are allowed to delete data must have the `fsdelete` custom claim set to `true`:

```
// Refer to: https://firebase.google.com/docs/auth/admin/custom-claims
admin.auth().setCustomUserClaims(uid, {
  fsdelete: true
}).then(...)
```

Then, the client can call `${function:fsdelete.name}` with the path parameter that specifies the data to delete.

Note that the sample code here is for JavaScript. Refer to the [Cloud Functions for Firebase documentation](https://firebase.google.com/docs/functions/callable) for syntax of other languages.

```
// Initialize Cloud Functions for Firebase with the desired location:
firebase.app().functions("${function:fsdelete.location}");

// Create and call the function:
const deleteFn = firebase.functions().httpsCallable("${function:fsdelete.name}");
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
