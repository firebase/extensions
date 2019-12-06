### Post-installation configuration

Before you can use this extension, you'll need to update your security rules, set up a Cloud Scheduler job, and add some code to your JavaScript app.

#### Update security rules

Update your Cloud Firestore security rules to allow lookups and writes to the `_counter_shards_` subcollection where you want the extension to count. For example, to allow clients to increment the `visits` field on any document in the `pages` collection, you can write rules like this:

```
match /databases/{database}/documents/pages/{page} {
  // Allow to increment only the 'visits' field and only by 1.
  match /_counter_shards_/{shardId} {
    allow get;
    allow write: if request.resource.data.keys() == ["visits"]
                   && (resource == null || request.resource.data.visits ==
                   resource.data.visits + 1);
  }
}
```


#### Set up a Cloud Scheduler job

**IMPORTANT:** Note the following about v0.1.1 of this extension:
- **If you updated your extension from v0.1.0 to v0.1.1:**  We recommend that you edit your Cloud Scheduler job to instead send a message to the extension's Pub/Sub topic, as described in this section. Although it's not recommended, if you leave your Cloud Scheduler job calling `${function:controller.url}`, your extension will continue to run as expected. For more information about the changes for v0.1.1, refer to the [changelog](https://github.com/firebase/extensions/blob/next/firestore-counter/CHANGELOG.md).
- **If you installed this extension for the first time at v0.1.1:** Follow the instructions as described in this section.


Set up a [Cloud Scheduler job](https://firebase.google.com/docs/functions/schedule-functions) to regularly send a message to the extension's Pub/Sub topic (`${param:EXT_INSTANCE_ID}`). This Pub/Sub topic then automatically triggers the Pub/Sub controller function (`${function:controllerPubSub}`). This Pub/Sub controller function is created by the extension and monitors the extension's workload.

You may need to enable some APIs in your Firebase project to use Cloud Scheduler.

As an example, to set up the required Cloud Scheduler job, you can run the following gcloud commands:

```
gcloud --project=${param:PROJECT_ID} services enable cloudscheduler.googleapis.com
gcloud --project=${param:PROJECT_ID} scheduler jobs create pubsub ${param:EXT_INSTANCE_ID} --schedule="* * * * *" --topic=${param:EXT_INSTANCE_ID} --message-body="{}"
```


#### Specify a document path and increment value in your app

1.  Download and copy the [Counter SDK](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/dist/sharded-counter.js) into your application project.

1.  Use the Counter SDK library in your code to increment counters. The code snippet below shows an example of how to use the library. For more comprehensive API documentation, refer to the [source code](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/src/index.ts).

  ```html
  <html>
    <head>
      <script src="https://www.gstatic.com/firebasejs/[version]/firebase-app.js"></script>
      <script src="https://www.gstatic.com/firebasejs/[version]/firebase-firestore.js"></script>
      <script src="sharded-counter.js"></script>
    </head>
    <body>
      <script>
        // Initialize Firebase.
        var firebaseConfig = { projectId: "${PROJECT_ID}" };
        firebase.initializeApp(firebaseConfig);
        var db = firebase.firestore();

        // Initialize the sharded counter.
        var visits = new sharded.Counter(db.doc("pages/hello-world"), "visits");

        // Increment the field "visits" of the document "pages/hello-world".
        visits.incrementBy(1);

        // Listen to locally consistent values.
        visits.onSnapshot((snap) => {
          console.log("Locally consistent view of visits: " + snap.data());
        });

        // Alternatively, if you don't mind counter delays, you can listen to the document directly.
        db.doc("pages/hello-world").onSnapshot((snap) => {
          console.log("Eventually consistent view of visits: " + snap.get("visits"));
        });
      </script>
    </body>
  </html>
  ```

### Using the extension

After you complete the post-installation configuration above, your extension will create subcollections in all the documents that your app uses as counters. The client SDK will write to these subcollections to distribute the write load, and the scheduled function you deployed will sum the subcollections' values into the single `visits` field (or whichever field you configured).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
