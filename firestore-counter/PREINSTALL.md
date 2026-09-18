Use this extension to add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high-velocity action such as views, likes, or shares.

Since Cloud Firestore has a limit of one sustained write per second, per document, this extension instead shards your writes across documents in a `_counter_shards_` subcollection. Each client only increments their own unique shard while the background workers (provided by this extension) monitor and aggregate these shards into a main document.

Here are some features of this extension:

- Scales from 0 updates per second to a maximum of 10,000 per second.
- Supports an arbitrary number of counters in your app.
- Works offline and provides latency compensation for the main counter.

Note that this extension requires client-side logic to work. We provide a [TypeScript client sample implementation](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/src/index.ts) and its [compiled minified JavaScript](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/dist/sharded-counter.js). You can use this extension on other platforms if you'd like to develop your own client code based on the provided client sample.

We also provide a [Node.js admin sample implementation](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/node/index.js)

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

After installing this extension, you'll need to:

- Update your [database security rules](https://firebase.google.com/docs/rules).
- Use the provided [client sample](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/src/index.ts), the provided [Node.js admin sample](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/node/index.js) or your own client code to specify your document path and increment values.

Detailed information for these post-installation tasks are provided after you install this extension.


#### Billing
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
 - Cloud Firestore
 - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))