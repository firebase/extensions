### Post-installation configuration

Before you can use this extension, you'll need to update your security rules, set up a scheduled function, and add some code to your JavaScript app.

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

#### Set up a scheduled function

Review the [scheduled function documentation](https://firebase.google.com/docs/functions/schedule-functions) to set up a call to `${function:controller.url}` every minute. You may need to enable some APIs in your Firebase project to use scheduled functions.

As an example, to set up a scheduled function, you can run the following [`gcloud`](https://cloud.google.com/sdk/gcloud/) commands:

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
