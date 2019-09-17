### Post-installation configuration

Before you can use this extension, you'll need to update your security rules, set up a scheduled function, and add some code to your JavaScript app.

#### Update security rules

Update your Cloud Firestore security rules to allow lookups and writes to the `_counter_shards_` subcollection where you want the extension to count. For example, to allow clients to increment the `visits` field on any document in the `pages` collection, you can write rules like this:

```
match /databases/{database}/documents/pages/{page} {
  // Allow to increment only 'visits' field and only by 1.
  match /_counter_shards_/{shardId} {
    allow get;
    allow write: if request.resource.data.keys() == ["visits"]
                   && (resource == null || request.resource.data.visits ==
                   resource.data.visits + 1);
  }
}
```

#### Set up a scheduled function

Set up a [scheduled function](https://firebase.google.com/docs/functions/schedule-functions) to call `${function:controller.url}` every minute.

For example, to set up a scheduled function, you can run the following [`gcloud`](https://cloud.google.com/sdk/gcloud/) commands:

```
gcloud services enable cloudscheduler.googleapis.com
gcloud scheduler jobs create http firestore-sharded-counter-controller --schedule="* * * * *" --uri=${function:controller.url} --project=${param:PROJECT_ID}
```

#### Specify a document path and increment value in your app

1.  Download and copy the [Counter SDK](https://dev-partners.googlesource.com/samples/firebase/mods/+/master/firestore-counter/clients/web/dist/sharded-counter.js) into your application project.

    Note: You might get a "Permission denied" error for the source repository. If you do, locate the **Sign in** button on the error page, then sign in to access to the repo.

1.  Use the Counter SDK library in your code to increment counters. The code snippet below is just an example, for more comprehensive API documentation, please refer to the [source code](https://dev-partners.googlesource.com/samples/firebase/mods/+/master/firestore-sharded-counter/clients/web/src/index.ts):

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
        var visits = new sharded.Counter(db.doc("pages/hello-world"), "stats.visits");

        // Increment the field "stats.visits" of the document "pages/hello-world".
        visits.incrementBy(1);

        // Listen to locally consistent values.
        visits.onSnapshot((snap) => {
          console.log("Locally consistent view of visits: " + snap.data());
        });

        // Alternatively, if you don't mind counter delays, you can listen to the document directly.
        db.doc("pages/hello-world").onSnapshot((snap) => {
          console.log("Eventually consistent view of visits: " + snap.get("stats.visits"));
        });
      </script>
    </body>
  </html>
  ```

### Using the extension

After you complete the post-installation configuration above, your extension will create subcollections in all the documents that your app uses as counters. The extension will use these subcollections to help track the counter in a scalable way.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
