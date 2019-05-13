You can now recursively delete Firestore documents or collections!

First, make sure users that are allowed to delete data have the
`fsdelete` custom claim set to `true`:

```
// See: https://firebase.google.com/docs/auth/admin/custom-claims
admin.auth().setCustomUserClaims(uid, {
    fsDelete: true
}).then(...)
```

In your client, call the HTTPS Callable Function `${function:fsdelete.name}`
with the path parameter specifying the data to delete:

```
// Sample code here is for JavaScript, see https://firebase.google.com/docs/functions/callable
// for syntax for other languages
const deleteFn = firebase.functions("${function:fsdelete.location}").httpsCallable("${function:fsdelete.name}");
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
