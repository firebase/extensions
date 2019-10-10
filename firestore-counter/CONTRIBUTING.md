# firestore-counter

**DESCRIPTION**: Auto-scalable counters for your app.

**FEATURES**:

- Zero configuration, one mod for all your app needs
- Automatically scales from 0 updates/sec to at least 10k updates/sec
- Efficient for very low traffic counters
- Handles gracefully bursts of up to thousands updates/sec
- Can support thousands of updates/sec per counter and millions of counters in an app
- Works well offline and provides latency compensation
  - Counter updates are immediately visible locally even though the main counter is eventually updated

**DETAILS**: This mod allows you to increment any fields in your documents at arbitrary rate.

Client SDK, instead of incrementing the field directly, increments their own shard in `_counter_shards_` subcollection. A background task is periodically aggregating these shards and eventually rolling them up to the main counters.

There are three cloud functions that orchestrate shard aggregations:

1. A `worker` function is responsible for monitoring and aggregating a range of shards. There may be 0 or hundreds of workers running concurrently to scale up to large workloads
2. A `controller` function runs every minute and monitors the health of the workers. It can scale up and down the number of workers as needed and recover a worker on failure.
3. A `onWrite` function triggers every time a shard is written and runs one-time aggregation. This improves latency for low workloads where no workers is running. To improve efficiency there's only one instance of this function running at any given time (`maxInstances` is set to 1).

# Installation

```
firebase mods:install . --project=<my-project-id>

Please check the post-install message for the final step to set up your mod.
```

# Web SDK

```
<html>
    <head>
        <script src="https://www.gstatic.com/firebasejs/6.2.0/firebase-app.js"></script>
        <script src="https://www.gstatic.com/firebasejs/6.2.0/firebase-firestore.js"></script>
        <script src="clients/web/dist/sharded-counter.js"></script>
    </head>
    <body>
        <script>
            // Initialize Firebase.
            var config = {};
            firebase.initializeApp(config);
            var db = firebase.firestore();

            // Initialize the sharded counter.
            var views = new sharded.Counter(db.doc("pages/hello-world"), "stats.views");

            // This will increment a field "stats.views" of the "pages/hello-world" document by 3.
            views.incrementBy(3);

            // Listen to locally consistent values
            views.onSnapshot((snap) => {
                console.log("Locally consistent view of visits: " + snap.data());
            });

            // Alternatively if you don't mind counter delays, you can listen to the document directly.
            db.doc("pages/hello-world").onSnapshot((snap) => {
                console.log("Eventually consistent view of visits: " + snap.get("stats.views"));
            })
        </script>
    </body>
</html>
```

# Building from source

```
    cd functions/
    npm install
    npm run build
```
