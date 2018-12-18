You can now recursively delete Firestore documents or collections!

First, make sure users that are allowed to delete data have the
`fsdelete` custom claim set to `true`:

```
// See: https://firebase.google.com/docs/auth/admin/custom-claims
admin.auth().setCustomUserClaims(uid, {
    fsDelete: true
}).then(...)
```

Next, call the `fsdelete` function with the path parameter specifying the
data to delete:

```
// See: https://firebase.google.com/docs/functions/callable
const deleteFn = firebase.functions().httpsCallable('fsdelete');
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