# Distributed Counter

**Description**: Records event counters at scale to accommodate high-velocity writes to Cloud Firestore.



**Details**: Use this extension to add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high-velocity action such as views, likes, or shares.

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

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)




**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Document path for internal state: What is the path to the document where the extension can keep its internal state?



**Cloud Functions:**

* **controllerCore:** Scheduled to run every minute. This function either aggregates shards itself, or it schedules and monitors workers to aggregate shards.

* **controller:** Maintained for backwards compatibility. This function relays a message to the extension's Pub/Sub topic to trigger the controllerCore function.

* **onWrite:** Listens for changes on counter shards that may need aggregating. This function is limited to max 1 instance.

* **worker:** Monitors a range of shards and aggregates them, as needed. There may be 0 or more worker functions running at any point in time. The controllerCore function is responsible for scheduling and monitoring these workers.



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to aggregate Cloud Firestore counter shards.)

* pubsub.publisher (Reason: Allows the HTTPS controller function to publish a message to the extension's Pub/Sub topic, which triggers the controllerCore function.)
