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

#### Client/Admin samples for incrementing counter and retrieving its value

##### Web Client (<v9 example)

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

##### Web Client (v9+ example)

```html
<html>
  <head> </head>
  <body>
    <script src="clients/web/dist/sharded-counter.js"></script>

    <script type="module">
      import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";

      // Add Firebase products that you want to use
      import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
      import {
        getFirestore,
        getDoc,
        doc,
        onSnapshot,
      } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

      // Initialize Firebase
      const firebaseApp = initializeApp({ projectId: "extensions-testing" });

      // initializeApp(firebaseConfig);
      const db = getFirestore(firebaseApp);


      const docRef = doc(db, "pages", "hello-world");


      // Initialize the sharded counter.
      var views = new sharded.Counter(docRef, "stats.views");

      // // This will increment a field "stats.views" of the "pages/hello-world" document by 3.
      views.incrementBy(4).then($ => console.log("returning document >>>>", $));

      // // Listen to locally consistent values
      views.onSnapshot(snap => {
        console.log("Locally consistent view of visits: " + snap.data());
      });

      //Alternatively if you don't mind counter delays, you can listen to the document directly.
      onSnapshot(doc(db, "pages", "hello-world"), snap => {
        console.log(
          "Eventually consistent view of visits: " + snap.get("stats.views")
        );
      });
    </script>
  </body>
</html>

  ```

##### Android Client

1. Follow the steps in [Add Firebase to your Android project](https://firebase.google.com/docs/android/setup) to use Firebase in your app.

2. Copy the [sample code](https://github.com/firebase/extensions/blob/next/firestore-counter/clients/android/src/main/java/com/firebase/firestore/counter/FirestoreShardedCounter.java) to the directory in which you want to use the `FirestoreShardedCounter` instance.

```java
import com.google.firebase.firestore.DocumentReference;
import com.google.firebase.firestore.DocumentSnapshot;
import com.google.firebase.firestore.EventListener;
import com.google.firebase.firestore.FirebaseFirestore;
import com.google.firebase.firestore.FirebaseFirestoreException;
import com.google.firebase.firestore.ListenerRegistration;


// somewhere in your app code initialize Firestore instance
FirebaseFirestore db = admin.firestore.getInstance();
// create reference to the collection and the document you wish to use 
DocumentReference doc = db.collection("pages").document("hello-world");
// initialize FirestoreShardedCounter with the document and the property which will hold the counter value
FirestoreShardedCounter visits = new FirestoreShardedCounter(doc, "visits");

// to increment counter
visits.incrementBy(1);

// listen for updates
EventListener<Double> snapshotListener = new EventListener<Double>(){
  @Override
  public void onEvent(@Nullable Double value, @Nullable FirebaseFirestoreException error) {
    // 'value' param is total amount of pages visits
  }
};
ListenerRegistration registration = visits.onSnapshot(snapshotListener);
// clean up event listeners once finished
registration.remove();

// make one time call to query total amount of visits
double totalVisits = visits.get();

// if you don't mind counter delays, you can listen to the document directly.
db.document("pages/hello-world").addSnapshotListener(new EventListener<DocumentSnapshot>() {
  @Override
  public void onEvent(@Nullable DocumentSnapshot value, @Nullable FirebaseFirestoreException error) {
    // total page visits
    double pageVisits = (double) value.get("visits");
  }
});
```

##### iOS Client

1. Ensure your Swift app already has Firebase [initialized](https://firebase.google.com/docs/ios/setup).
2. Copy and paste the sample [code](https://github.com/firebase/extensions/blob/next/firestore-counter/clients/ios/Sources/FirestoreCounter/FirestoreCounter.swift) and create this file  `FirestoreShardedCounter.swift` in the relevant directory you wish to use the `FirestoreShardedCounter` instance.

```swift
import UIKit
import FirestoreCounter
import FirebaseFirestore

class ViewController: UIViewController {
  // somewhere in your app code initialize Firestore instance
  var db = Firestore.firestore()
  // create reference to the collection and the document you wish to use 
  var doc = db.collection("pages").document("hello-world")
  // initialize FirestoreShardedCounter with the document and the property which will hold the counter value
  var controller = FirestoreShardCounter(docRef: doc, field: "visits")

  override func viewDidLoad() {
    super.viewDidLoad()
    // event listener which returns total amount
    controller.onSnapshot { (value, error) in
      if let error = error {
        // handle error
      } else if let value = value {
        // 'value' param is total amount of pages visits
      }
    }
  }

  @IBAction func getLatest(_ sender: Any) {
    // get current total
    controller.get() { (value, error) in
      if let error = error {
        // handle error
      } else if let value = value {
        // 'value' param is total amount of pages visits
      }
    }
  }

  @IBAction func incrementer(_ sender: Any) {
    // to increment counter
    controller.incrementBy(val: Double(1))
  }
}

```


##### Node.js Admin

1. Follow the steps in [Add Firebase Admin SDK to your server](https://firebase.google.com/docs/admin/setup) to use Firebase in your app.

2.  Download and copy the [Node.js Admin sample](https://github.com/firebase/extensions/blob/master/firestore-counter/clients/node/index.js) into your application project.

```js
  // Initialize Firebase.
  const admin = require('firebase-admin');
  admin.initializeApp();
  const db = admin.firestore();

  const Counter = require("./distributed_counter")

  const visits = new Counter(db.collection("pages").doc("hello-world"), "visits")

  // Increment the field "visits" of the document "pages/hello-world".
  visits.incrementBy(1);

  // Listen to locally consistent values.
  visits.onSnapshot((snap) => {
    console.log("Locally consistent view of visits: " + snap.data());
  });

  // Alternatively, if you don't mind counter delays, you can listen to the document directly.
  db.collection("pages").doc("hello-world").onSnapshot((snap) => {
    console.log("Eventually consistent view of visits: " + snap.get("visits"));
  });
```

#### Upgrading from v0.1.3 and earlier

If you installed v0.1.3 or an earlier version of this extension, you set up a Cloud Scheduler job that either sent messages to the extension's Pub/Sub topic (`${param:EXT_INSTANCE_ID}`) or called the extension's controller function. Starting in v0.1.4, the controllerCore function (`${function:controllerCore.name}`) has a configurable schedule, so the manually-created Cloud Scheduler job is no longer required and will start to fail.

Delete the old Cloud Scheduler job on the [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=_) page of the Cloud console.


### Using the extension

After you complete the post-installation configuration above, the process runs as follows:

1. Your extension creates subcollections in all the documents that your app uses as counters.

2. The client sample writes to these subcollections to distribute the write load.

3. The controllerCore function sums the subcollections' values into the single `visits` field (or whichever field you configured in your master document).

4. After each summation, the extension deletes the subcollections, leaving only the count in the master document. This is the document field to which you should listen for the count.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
