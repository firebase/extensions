This extension will automatically sync data from the specified collection to custom claims on a corresponding Firebase Auth user. For example, if I have a user with a UID of `abc123` I could use the Firestore SDK to set custom claims like so:

```js
db.collection("user_claims")
  .doc("abc123")
  .set({
    role: "admin",
    groups: ["example1", "example2"],
  });
```

Once the document has been written, the extension will automatically set the same custom claims (in this case, `role` and `groups`) on the Firebase Auth user with a UID corresponding to the document ID.

# Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

<!-- List all products the extension interacts with -->

- Cloud Functions
- Cloud Firestore

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
