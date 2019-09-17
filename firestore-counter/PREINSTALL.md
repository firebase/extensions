Use this extension to add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high-velocity action such as views, likes, or shares.

Cloud Firestore has a limit of 1 sustained write per second, per document. This limit can make counting in Cloud Firestore challenging.
This extension works around the concurrent document writes per second limitation and lets your app update any field in any document of your Cloud Firestore database at a high rate (security rules permitting). It accomplishes this by using numerous temporary shards in a `_counter_shards_` subcollection; allowing it to sustain high bursts of traffic. Each client only increments their own unique shard while the background workers (Cloud Functions for Firebase) continue to monitor and aggregate these shards onto the master document.

Here are some of the important features of this extension:

- Minimal configuration, one extension for all your app needs.
- Automatically scales from 0 updates per second to at least 10 thousand per second.
- Supports an arbitrary number of counters in your app with no additional configuration.
- Works well offline and provides latency compensation, i.e. counter updates are immediately visible locally even though the main counter is eventually updated.
- Resource efficient.
  - `worker` functions will scale down to 0 for low workloads if needed.
  - `onWrite` function is [limted to 1 instance](https://cloud.google.com/functions/docs/max-instances#using_max_instances).
  - `controller` is the only function that runs every minute regardless of the workload.

This mod can work on any platform. However there's only [JavaScript SDK](https://dev-partners.googlesource.com/samples/firebase/mods/+/master/firestore-sharded-counter/clients/web/src/index.ts) included at this time. This will change in the future.

### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

After installation, you'll need to update your database security rules and set up a [scheduled function](https://firebase.google.com/docs/functions/schedule-functions) to regularly call one of the functions created by this extension. Detailed information for these post-installation tasks are provided after you install this extension.

This extension provides a Counter SDK that you need to install in your app. You can then use this library in your code to specify your document path and increment values. Detailed instructions to install this SDK and use it are provided after you install this extension.

### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Firestore
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
