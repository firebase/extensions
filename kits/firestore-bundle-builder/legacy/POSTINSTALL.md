# See it in Action!

The first thing you’ll want to do is create a new bundle specification in Firestore. To do this, you can use the admin dashboard for this extension by running the following commands:

```bash
git clone https://github.com/firebase/firestore-bundle-builder.git
cd firestore-bundle-builder/admin-dashboard
npm install
npm run dev
```

View the dashboard [README](https://github.com/firebase/firestore-bundle-builder/tree/main/admin-dashboard) for additional setup instructions.

When creating a new bundle specification via the admin dashboard, a number of fields are available (fields marked with \* are required):

- **Bundle ID \***: The unique bundle ID, this will be used when performing HTTP requests (see below).
- **Client Cache**: An optional value. Specifies how long to keep the bundle in the client's cache, in seconds. If not defined, client-side cache is disabled.
- **Server Cache**: An optional value. Only use in combination with Firebase Hosting. Specifies how long to keep the bundle in Firebase Hosting's CDN cache, in seconds.
- **File Cache**: An optional value. Specifies how long (in seconds) to keep the bundle in a Cloud Storage bucket, in seconds. If not defined, Cloud Storage bucket is not accessed.
- **Not Before File Cache**: An optional value. If a 'File Cache' is specified, bundles created before this timestamp will not be file cached.
- **Documents**: A comma separated list of document paths. If specified, only these documents will be included in the bundle.
- **Params**: Optional parameters to define. Can be referenced in queries via the `$param` notation and provided via HTTP query params (e.g. ?name=).
- **Queries**: A list of queries to include in the bundle. Each query has its own unique ID a client can use via the `namedQuery` API (see below).

Once a bundle specification has been created, you can view the bundle output by visiting the deployed function URL along with the bundle ID which has been specified:

```
https://$us-central1-${param:PROJECT_ID}.cloudfunctions.net/ext-${param:EXT_INSTANCE_ID}-serve/:bundleId
```

If any parameters have been defined, they can be provided via Query Params in the URL. These can later referenced in query condition values via the ‘$param’ notation:

```
https://us-central1-${param:PROJECT_ID}.cloudfunctions.net/ext-${param:EXT_INSTANCE_ID}-serve/:bundleId?name=david&limit=10
```

**Note: if your build a complex bundle query, you may need to create a [Firestore index](https://firebase.google.com/docs/firestore/query-data/indexing) when calling the bundle endpoint for the first time. View the deployed function logs for an index creation link if your function errors.**

The [official documentation](https://firebase.google.com/docs/extensions/official/firestore-bundle-builder) for this extension provided JavaScript code samples on how to load and use your created bundles in a client application, and full reference documentation for bundle specifications.

# Using the extension

See the [official reference documentation](https://firebase.google.com/docs/extensions/official/firestore-bundle-builder) for this extension for information on serving the bundle with Firebase Hosting CDN and loading the generated bundles into your application.

# Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
