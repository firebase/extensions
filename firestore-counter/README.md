# Distributed Counter

**Description**: Records event counters at scale to accommodate high-velocity writes to Cloud Firestore.



**Details**: Use this extension to add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high-velocity action such as views, likes, or shares.

Since Cloud Firestore has a limit of one sustained write per second, per document, this extension instead shards your writes across documents in a `_counter_shards_` subcollection. Each client only increments their own unique shard while the background workers (provided by this extension) monitor and aggregate these shards into a main document.

Here are some features of this extension:

- Scales from 0 updates per second to at least 10,000 per second.
- Supports an arbitrary number of counters in your app.
- Works offline and provides latency compensation for the main counter.

Note that this extension is currently fully resourced for use with JavaScript apps (we provide the required [JS SDK](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/src/index.ts)). You can, however, use this extension on other platforms if you'd like to develop your own API based on the provided JS SDK.


#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

After installing this extension, you'll need to:

- Update your [database security rules](https://firebase.google.com/docs/rules).
- Set up a [scheduled function](https://firebase.google.com/docs/functions/schedule-functions) to regularly call the controller function, which is created by this extension and monitors the extension's workload.
- Install the provided [Counter SDK](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/src/index.ts) in your app. You can then use this library in your code to specify your document path and increment values.

Detailed information for these post-installation tasks are provided after you install this extension.


#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Firestore
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)




**Configuration Parameters:**

* Deployment location: Where should the extension be deployed? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Document path for internal state: What is the path to the document where the extension can keep its internal state?



**Cloud Functions:**

* **controller:** Scheduled to run every minute. This function either aggregates shards itself, or it schedules and monitors workers to aggregate shards.

* **onWrite:** Listens for changes on counter shards that may need aggregating. This function is limited to max 1 instance.

* **worker:** Monitors a range of shards and aggregates them, as needed. There may be 0 or more worker functions running at any point in time. The controller function is responsible for scheduling and monitoring these workers.



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to aggregate Cloud Firestore counter shards.)
