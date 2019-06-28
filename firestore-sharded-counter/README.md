# Installation
`firebase mods:install . --project=<my-project-id>`

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
            // Initialize Firebase
            var config = {};
            firebase.initializeApp(config);
            var db = firebase.firestore();

            // Initialize counter
            var views = new sharded.Counter(db.doc("pages/hello-world"), "stats.views");
            
            // Increment the counter
            views.incrementBy(firebase.firestore.FieldValue.increment(3));

            // Listen to locally consistent values
            views.onSnapshot((snap) => {
                console.log("Visits: " + snap.data());
            });
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