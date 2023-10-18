# Get Started

## How It Works

The extension deploys an HTTP function that serves [Cloud Firestore data bundles](https://firebase.google.com/docs/firestore/bundles). You define the bundles in Firestore documents, and the extension serves static binary file data bundle via HTTP requests, along with various built-in caching mechanisms using Firebase Hosting CDN or Cloud Storage. When no bundle exists or existing bundles have expired, this function will build and cache a new bundle on demand.

To use this extension, you need to first create one or more bundle specifications in Firestore using the extension’s [admin dashboard](https://github.com/firebase/firestore-bundle-builder/tree/main/admin-dashboard). The bundle specification is how you define named queries (collection queries and specific document paths to add to the bundle).

Inside the bundle spec, you can also define parameters meant to be used in named queries. You set values for these parameters using URL query params when you call the HTTP function.

The above link provides some instructions so you can run the admin utilities locally. Once you have the web app set up, navigate to localhost:3000 to create a spec using the UI:

![example](/docs/firestore-bundle-builder/media/admin-ui.png)

## Building and serving the Bundle

Once you’ve installed the extension and created a bundle spec, you can start building and serving bundles by calling the HTTP endpoint provided by the extension.

Depending on the bundle specification, the requested bundle might be returned from the client's cache, Firebase Hosting cache or a Cloud Storage file. When all caches have expired, a new serve request will trigger Firestore queries to build the bundle on demand.

You can take advantage of Firebase Hosting CDN’s capabilities by setting up a Firebase Hosting site that points to the serve function using a rewrite rule. CDNs replicate your bundle across many different servers, so that your users can load the bundle from the closest server automatically. This is the preferred approach.

To set this up in Firebase Hosting, create or edit a `firebase.json` file with the following contents and [deploy the site](https://firebase.google.com/docs/hosting/test-preview-deploy#deploy-project-directory-to-live):

```json
{
  "hosting": {
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/bundles/*",
        "function": "ext-firestore-bundle-builder-serve"
      }
    ]
  }
}
```

Once deployed, you can access your bundles from the CDN using your site URL. For example: `https://your-site-url.com/bundles/:bundleId`.

Alternatively, you can configure the extension to cache data in Cloud Storage if you don’t want to use Firebase Hosting. In this case, you would call the deployed HTTP function directly to generate bundles.

## Client Integration

Next you can consume a bundle with the `loadBundle` API of the Cloud Firestore SDKs. First the bundle needs to be downloaded, and then provided to the SDK. For example:

```js
import { loadBundle } from "firebase/firestore";

// Download the bundle from the Firebase Hosting CDN:
const bundle = await fetch("/bundles/:bundleId");

// If not using a CDN, download the bundle directly:
// const bundle = await fetch('https://<location>-<project-id>.cloudfunctions.net/ext-firestore-bundle-builder-serve/:bundleId');

await loadBundle(bundle);
```

Once loaded, you can use the data from the bundle:

If you specified an array of document paths when you defined the bundle, you can get the document data on your client via the bundle:

```js
import { getFirestore, doc, getDocFromCache } from "firebase/firestore";
// Bundle Document IDs: ['users/92x1NgSWYKUC4AG4s2nHGMR2ikZ2']

const ref = doc(getFirestore(), "users/92x1NgSWYKUC4AG4s2nHGMR2ikZ2");
const snapshot = await getDocFromCache(ref);
```

If you specified queries, you can use the `namedQuery` API to run a query from the bundle:

```js
import { getFirestore, namedQuery } from "firebase/firestore";
const query = await namedQuery(getFirestore(), "queryId");
const snapshot = await getDocsFromCache(query);
```

Query IDs are defined as a key of each `queries` property definition (see below).
