# Delete Cloud Firestore subcollections

**Description**: Call the HTTPS function created by this mod to delete a specified Cloud Firestore collection or document, as well as all its subcollections.



**Details**: Use this mod to recursively delete Cloud Firestore data.

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

When you use Firebase Mods, you're only charged for the underlying resources that you use. Firebase Mods themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)




**Configuration Parameters:**

* Deployment location: Where should the mod be deployed? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).



**Cloud Functions:**

* **fsdelete:** When called, recursively deletes your specified Cloud Firestore collection or document, as well as all its subcollections.



**Access Required**:



This mod will operate with the following project IAM roles:

* datastore.user (Reason: Allows the mod to delete data from Cloud Firestore)

* firebase.viewer (Reason: Provides access to the `firebase.projects.get` permission required by firebase-tools (the Firebase CLI).)
