### Post-installation configuration

Before you can use this extension, you'll need to update your security rules and add some code to your JavaScript app.


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


#### Specify a document path and increment value in your web app

1.  Download and copy the [compiled client sample](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/dist/sharded-counter.js) into your application project.

1.  Use the client sample in your code to increment counters. The code snippet below shows an example of how to use it. To see the full reference implementation, refer to the sample's TypeScript [source code](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/web/src/index.ts).

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
        var firebaseConfig = { projectId: "${param:PROJECT_ID}" };
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


#### Upgrading from v0.1.3 and earlier

If you installed v0.1.3 or an earlier version of this extension, you set up a Cloud Scheduler job that either sent messages to the extension's Pub/Sub topic (`${param:EXT_INSTANCE_ID}`) or called the extension's controller function. Starting in v0.1.4, the controllerCore function (`${function:controllerCore.name}`) has a configurable schedule, so the manually-created Cloud Scheduler job is no longer required and will start to fail.

Delete the old Cloud Scheduler job on the [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=_) page of the Cloud console.


### Using the extension

After you complete the post-installation configuration above, the process runs as follows:

1. Your extension creates subcollections in all the documents that your app uses as counters.

1. The client sample writes to these subcollections to distribute the write load.

1. The controllerCore function sums the subcollections' values into the single `visits` field (or whichever field you configured in your master document).

1. After each summation, the extension deletes the subcollections, leaving only the count in the master document. This is the document field to which you should listen for the count.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
