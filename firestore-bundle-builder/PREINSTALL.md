Firestore data bundles can make certain types of Firestore applications much faster and/or less expensive. Data bundles are serialized groups of documents -- either individual documents, or a number of documents that you've retrieved using a specific query.

Bundles are useful when you want to cache publicly available documents that are read by all users of your app. Some common use cases include:
- Public data visualizations (e.g. public poll results or disaster updates)
- E-commerce catalogs

[Kara’s Coffee](https://github.com/FirebaseExtended/karas-coffee), an online coffee shop built with Firebase Extensions, uses a [Firestore bundle](https://us-central1-karas-coffee.cloudfunctions.net/ext-firestore-bundle-server-serve/shop) to cache its catalog of coffee offerings.

This extension simplifies the process of adding [Cloud Firestore data bundles](https://firebase.google.com/docs/firestore/bundles) to your application. Once this extension is configured, you can generate bundles on demand via HTTP requests.

The extension serves these data bundles from either Firebase Hosting CDN (preferred) or from Firebase [storage](https://firebase.google.com/docs/storage). You can load these bundles from your app and interact with the bundle data just like other data loaded from Firestore.

With bundles, you avoid making extra calls against the Firestore database. If your application has a substantial number of users, this can lead to some cost savings, and could potentially be faster, too.

Learn more about how this extension works and how to integrate it into your application by reading the [official Firebase documentation](https://firebase.google.com/docs/extensions/official/firestore-bundle-builder) for this extension.

#### Pre-Requisites

Before installing this extension, you'll need to set up these services in your Firebase project:

- [Set up Cloud Firestore](https://firebase.google.com/docs/firestore/quickstart)
- [Set up Cloud Functions](https://firebase.google.com/docs/functions)
- [Set up Cloud Storage](https://firebase.google.com/docs/storage)

#### Billing

To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
  - Cloud Firestore
  - Cloud Functions (Node.js 10+ runtime. See FAQs)
  - Cloud Storage
