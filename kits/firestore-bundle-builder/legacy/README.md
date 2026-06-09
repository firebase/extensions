# Firestore Bundle Builder

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Caches publicly available documents in Cloud Firestore data bundles that are served from either Firebase Hosting CDN or from Firebase storage



**Details**: Firestore data bundles can make certain types of Firestore applications much faster and/or less expensive. Data bundles are serialized groups of documents -- either individual documents, or a number of documents that you've retrieved using a specific query.

Bundles are useful when you want to cache publicly available documents that are read by all users of your app. Some common use cases include:
- Public data visualizations (e.g. public poll results or disaster updates)
- E-commerce catalogs

[Kara’s Coffee](https://github.com/FirebaseExtended/karas-coffee), an online coffee shop built with Firebase Extensions, uses a [Firestore bundle](https://us-central1-karas-coffee.cloudfunctions.net/ext-firestore-bundle-server-serve/shop) to cache its catalog of coffee offerings. 


This extension simplifies the process of adding [Cloud Firestore data bundles](https://firebase.google.com/docs/firestore/bundles) to your application. Once this extension is configured, you can generate bundles on demand via HTTP requests.

The extension serves these data bundles from either Firebase Hosting CDN (preferred) or from Firebase [storage](https://firebase.google.com/docs/storage). You can load these bundles from your app and interact with the bundle data just like other data loaded from Firestore.

With bundles, you avoid making extra calls against the Firestore database. If your application has a substantial number of users, this can lead to cost savings and improved querying speeds.

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




**Configuration Parameters:**

* Collection to store bundle specification documents: Path to the Firestore collection whose documents are specifications of bundles the extension will build.

* Google Cloud Storage bucket to save the built bundle files: The Cloud Storage bucket to save the built bundle files. This applies when the bundle specification has `fileCache` enabled.

* Prefix to use for bundle files saved in Google Cloud Storage.: The prefix for all the bundle files built and saved in Cloud Storage. This applies when the bundle specification has `fileCache` enabled.



**Cloud Functions:**

* **serve:** HTTPS function that serves bundled content from Cloud Storage cache or by dynamically building.



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to read configuration and build bundles from Firestore.)

* storage.objectAdmin (Reason: Allows the extension to save built bundles in Cloud Storage)
