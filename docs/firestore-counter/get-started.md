# Get started

## Using the Firestore Counter extension

The Firestore Counter extension (`firestore-counter`) lets you add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high-velocity action such as views, likes, or shares.

Since Cloud Firestore has a limit of one sustained write per second, per document, this extension instead shards your writes across documents in a `_counter_shards_`
 subcollection. Each client only increments their own unique shard while the background workers (provided by this extension) monitor and aggregate these shards into the main document.

Here are some features of this extension:

- Scales from 0 updates per second to a maximum of 10,000 per second.
- Supports an arbitrary number of counters in your app.
- Works offline and provides latency compensation for the main counter.

> Note that this extension requires client-side logic to work. We provide a [TypeScript client sample implementation](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/src/index.ts) and its [compiled minified JavaScript](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/dist/sharded-counter.js). You can use this extension on other platforms if you'd like to develop your own client code based on the provided client sample.

We also provide a [Node.js admin sample implementation](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/node/index.js)

>

## Pre-installation setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

After installing this extension, you'll need to:

- Update your [database security rules](https://firebase.google.com/docs/rules).
- Use the provided [client sample](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/src/index.ts), the provided [Node.js admin sample](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/node/index.js), or your own client code to specify your document path and increment values.

## **Install the extension**

To install the extension, follow the steps on the [Install Firebase Extension](https://firebase.google.com/docs/extensions/install-extensions) page. In summary, do one of the following:

- **Firebase console:** Click the following button:
  [Install the Firestore Counter extension](https://console.firebase.google.com/project/_/extensions/install?ref=firebase%2Ffirestore-counter)
- **CLI:** Run the following command:

  ```bash
  firebase ext:install firebase/storage-resize-images --project=projectId-or-alias
  ```

During the installation of the extension, you will be prompted to specify a number of configuration parameters:

- **Cloud Functions location:**
  Select the location of where you want to deploy the functions created for this extension. You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).
- **Document path for the internal state:**
  What is the path to the document where the extension can keep its internal state?
- **Frequency for controllerCore function to be run:**
  In minutes, how often should the function to aggregate shards be run?
