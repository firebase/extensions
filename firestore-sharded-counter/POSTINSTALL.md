Before you can use this mod, you'll need to update your security rules, set up a scheduled function, and add some code to your JavaScript app.

1.  Update your Cloud Firestore security rules to allow reads and writes to the `_counter_shards_` subcollection.

    ```
    match /databases/{database}/documents/pages/{page} {
      match /_counter_shards_/{shardId} {
        allow read, write;
      }
    }
    ```

1.  Set up a [scheduled function](https://firebase.google.com/docs/functions/schedule-functions) to call `${function:controller.url}` every minute.

    You can do this setup by running the following [`gcloud`](https://cloud.google.com/sdk/gcloud/) command:

    ```
    gcloud scheduler jobs create http firestore-sharded-counter-controller --schedule="* * * * *" --uri=${function:controller.url} --project=${param:PROJECT_ID}
    ```
1.  Download and copy the [Counter SDK](https://dev-partners.googlesource.com/samples/firebase/mods/+/master/firestore-sharded-counter/clients/web/dist/sharded-counter.js) into your application project.

    Note: You might get a "Permission denied" error for the source repository. If you do, locate the **Sign in** button on the error page, then sign in to access to the repo.

1.  Use the Counter SDK library in your code:

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
                var firebaseConfig = {};
                firebase.initializeApp(firebaseConfig);
                var db = firebase.firestore();

                // Initialize the sharded counter.
                var views = new sharded.Counter(db.doc("pages/hello-world"), "stats.views");

                // Increment by 3 the field "stats.views" of the document: ${param:MOD_METADATA_DOC}.
                // (use your desired increment amount)
                views.incrementBy(3);

                // Listen to locally consistent values.
                views.onSnapshot((snap) => {
                    console.log("Locally consistent view of visits: " + snap.data());
                });

                // Alternatively, if you don't mind counter delays, you can listen to the document directly.
                db.doc("pages/hello-world").onSnapshot((snap) => {
                    console.log("Eventually consistent view of visits: " + snap.get("stats.views"));
                })
            </script>
        </body>
    </html>
    ```
    
As a best practice, you can [monitor the activity](https://firebase.google.com/docs/mods/manage-installed-mods#monitor) of your installed mod, including checks on its health, usage, and logs.
