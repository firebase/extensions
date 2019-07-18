## Final installation tep

To finish the installation please set up a cloud scheduler job to call the controller function every minute. You can do it by running the following gcloud command.

```
gcloud scheduler jobs create http firestore-sharded-counter-controller --schedule="* * * * *" --uri=${function:controller.url} --project=${param:PROJECT_ID}
```

## Integrate into your mod
Once installation is complete you can now add this to your project.

1. Download and copy the [Counter SDK](https://dev-partners.googlesource.com/samples/firebase/mods/+/master/firestore-sharded-counter/clients/web/dist/sharded-counter.js) into your project. 
1. Once installed use it in your project. Here's a code sample with how to use it:

```html
<html>
    <head>
        <script src="https://www.gstatic.com/firebasejs/6.2.0/firebase-app.js"></script>
        <script src="https://www.gstatic.com/firebasejs/6.2.0/firebase-firestore.js"></script>
        <script src="sharded-counter.js"></script>
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