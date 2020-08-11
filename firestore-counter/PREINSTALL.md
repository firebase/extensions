Use this extension to add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high-velocity action such as views, likes, or shares.

Since Cloud Firestore has a limit of one sustained write per second, per document, this extension instead shards your writes across documents in a `_counter_shards_` subcollection. Each client only increments their own unique shard while the background workers (provided by this extension) monitor and aggregate these shards into a main document.

Here are some features of this extension:

- Scales from 0 updates per second to a maximum of 10,000 per second.
- Supports an arbitrary number of counters in your app.
- Works offline and provides latency compensation for the main counter.

Note that this extension requires client-side logic to work. We provide a [TypeScript client sample implementation](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/src/index.ts) and its [compiled minified JavaScript](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/dist/sharded-counter.js). You can use this extension on other platforms if you'd like to develop your own client code based on the provided client sample.


#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

After installing this extension, you'll need to:

- Update your [database security rules](https://firebase.google.com/docs/rules).
- Set up a [Cloud Scheduler job](https://cloud.google.com/scheduler/docs/quickstart) to regularly call the controllerCore function, which is created by this extension. It works by either aggregating shards itself or scheduling and monitoring workers to aggregate shards.
- Use the provided [client sample](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/src/index.ts) or your own client code to specify your document path and increment values.

Detailed information for these post-installation tasks are provided after you install this extension.


#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Firestore
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. Due to the services used by this extension, the Blaze plan is required. This extension’s Cloud functions will run on Node.js 10. You will be charged a small amount (less than $0.10) when you deploy this extension, including when you make configuration changes and apply future updates. [Read FAQs](https://firebase.google.com/support/faq#functions-pricing).

The Blaze plan also allows you to extend your project with paid Google Cloud Platform features. You pay only for the resources that you consume, allowing you to scale with demand. The Blaze plan also offers a generous [free tier](https://firebase.google.com/pricing) of usage.

