# firestore-sharded-counter

**VERSION**: 0.1.0

**DESCRIPTION**: Increment counters in your Firestore documents at any rate. No more [1 write per second limitation!](https://firebase.google.com/docs/firestore/quotas#writes_and_transactions)



**CONFIGURATION PARAMETERS:**

* Deployment location: *Where should the mod be deployed? You usually want a location close to your database. For help selecting a location, visit https://firebase.google.com/docs/functions/locations.*

* Document path for internal state: *What is the path to the document where the mod can keep its internal state?*



**CLOUD FUNCTIONS CREATED:**

* controller (HTTPS)

* onWrite (providers/cloud.firestore/eventTypes/document.write)

* worker (providers/cloud.firestore/eventTypes/document.write)



**DETAILS**: Use this mod to add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high velocity action such as views, likes, or shares.

Firestore has a restrictive limit of 1 per second of sustained write rate to a document. That makes counting in Firestore very challenging.
This mod works around this limitation and lets your app update any field in any document of your Firestore database at high rate (security rules permitting). It accomplishes that by using numerous temporary shards to sustain even the highest bursts of traffic. Each client is incrementing their own unique shard and only background workers running as Cloud Functions for Firebase are continuously monitoring and aggregating these shards to the master documents.

Here are some of the important features of this mod:

- Minimal configuration, one mod for all your app needs.
- Automatically scales from 0 updates per second to at least 10 thousand.
- Supports an arbitrary number of counters in your app with no additional
  configuration.
- Works well offline and provides latency compensation.
  - Counter updates are immediately visible locally even though the main counter is eventually updated.
- Resource efficient.
  - `worker` functions will scale down to 0 for low workloads if needed.
  - `onWrite` function is [limted to 1 instance](https://cloud.google.com/functions/docs/max-instances#using_max_instances).
  - `controller` is the only function that runs every minute regardless of the workload.

This mod can work on any platform. However there's only [JavaScript SDK](https://dev-partners.googlesource.com/samples/firebase/mods/+/master/firestore-sharded-counter/clients/web/src/index.ts) included at this time. This will change in the future.

Please remember to set adequate security rules for your app to allow counter lookups and updates. On top of the access to the document holding a counter you need to give access to `_counter_shards_` subcollections as well.

Here's an example of how you could allow clients to increment "visits" field on
any document "page" in "pages" collection.
```
match /databases/{database}/documents/pages/{page} {
  // "page" documents in this path contain "visits" field that counts all the
  // visits to the page. Only read access is necessary, clients will not update
  // these documents directly.
  allow read;

  // Clients need to be able to read and write to their shards.
  match /_counter_shards_/{shardId} {
    // Allow shard lookups for latency compensation.
    allow get;

    // Querying on these should be disabled.
    allow list: if false;

    // Allow to increment only 'visits' field and only by 1.
    allow create: if request.resource.data.keys().size() == 1 &&
      request.resource.data.visists == 1;
    allow update: if request.resource.data.keys().size() == 1 &&
      request.resource.data.visits == resource.data.visits + 1;

    // Disable deletes.
    allow delete: if false;
  }
}
```

After installation, you'll need to set up a [scheduled function](https://firebase.google.com/docs/functions/schedule-functions) to help the controller function (`${function:controller.url}`).



**ACCESS REQUIRED**:



This mod will operate with the following project IAM roles:

* datastore.user (Reason: Allows the mod to aggregate Cloud Firestore counter shards.)
