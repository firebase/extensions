# How to use this extension

## Embedding documents

1.  Go to your [Cloud Firestore dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/firestore/data) in the Firebase console.

2.  If it doesn't exist already, create a collection called `${param:COLLECTION_NAME}`.

3.  Create a document with a field named `${param:INPUT_FIELD_NAME}`, and add text you would like to embed.

4.  In a few seconds, you'll see a new field called `${param:OUTPUT_FIELD_NAME}` pop up in the same document you just created. It will contain the embedding for the text in `${param:INPUT_FIELD_NAME}`

## Querying the index

**Important**: Before you will be able to query the collection, firestore will have to build a vector index. This extension will trigger the basic index (no prefilters) upon installation or reconfiguration.

You can check the build status of indexes here:

https://console.firebase.google.com/project/${param:PROJECT_ID}/firestore/indexes

Where you have replaced `<DIMENSION>` with the dimension of the embedding space you are using, e.g 768 for Gemini.

#### Querying using JavaScript

Once the index is created, you may query it either through a callable cloud function deployed by the extension. For the snippet below you will have to have Firebase Auth enabled, and anonymous sign-ins enabled.

```javascript
import {getFunctions, httpsCallable} from 'firebase/functions';
import {getAuth, signInAnonymously} from 'firebase/auth';
import {initializeApp} from 'firebase/app';

const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth
const auth = getAuth(app);

// Initialize Firebase Functions with the specified region
const functions = getFunctions(app, '${param:LOCATION}');

// Sign in anonymously
signInAnonymously(auth)
  .then(() => {
    const queryCallable = httpsCallable(
      functions,
      'ext-${param:EXT_INSTANCE_ID}-queryCallable'
    );

    queryCallable({query: 'foo bar'})
      .then(result => {
        // Read result
        console.log(result.data);
      })
      .catch(error => {
        console.error('Error querying function:', error);
      });
  })
  .catch(error => {
    console.error('Error signing in anonymously:', error);
  });
```

Or by adding a document to the collection `_${param:EXT_INSTANCE_ID}/index/queries` with a `query` field and an (optional) limit field.

### Prefilters

The callable function deployed by this extension supports prefiltering on queries.

A sample callable function argument is as follows:

```
{
    query: "my query",
    limit: 4,
    prefilters: [
        {
            field: "age",
            operator: "==",
            value: 30
        }
    ]
}
```

It is important to note that such a query will require a composite index. The first call you make to the function will fail, and a `gcloud` CLI command will be logged which will trigger the build of an appropriate index.

The response data returned from the callable function will be an object with shape

```
{
  ids: string[]
}
```

Where ids is an array of document ID strings.

## Setting up a custom embedding function

This extension may be configured to use embedding models other than Gemini, Vertex AI, and OpenAI. To use this feature you must specify additional configuration parameters:

- Custom embedding endpoint: This is the endpoint of some http function which should accept a POST request with sample body shape:

```
{
    "batch": string[]
}
```

It must return a response with body of type

```
{
    embeddings: number[][]
}
```

The lengths of `batch` and `embeddings` must match.

- Custom embedding dimension: This is the dimension of your custom embedding

- Custom embedding batch size: The extension will POST to the custom function endpoint in batches of this size.

Here is a simple example of a custom embedding function:

```js
const {https} = require('firebase-functions');
const {logger} = require('firebase-functions');

// This function is triggered on HTTP requests
exports.processBatch = https.onRequest((request, response) => {
  // Log the incoming request
  logger.info('Processing batch', {structuredData: true});

  // Ensure the request is a POST request
  if (request.method !== 'POST') {
    // Respond with 405 Method Not Allowed if not a POST request
    response.status(405).send('Only POST requests are accepted');
    return;
  }

  try {
    // Parse the request body
    const {batch} = request.body;

    // Validate the batch input
    if (!Array.isArray(batch)) {
      response
        .status(400)
        .send('Invalid input: batch must be an array of strings.');
      return;
    }

    // Map each string in the batch to [1, 0] if it contains "cat", [0, 1] otherwise
    const embeddings = batch.map(item =>
      item.includes('cat') ? [1, 0] : [0, 1]
    );

    // Send the response with the embeddings array
    response.send({embeddings});
  } catch (error) {
    // Handle any errors that might occur
    logger.error('Error processing request', {error});
    response
      .status(500)
      .send('An error occurred while processing the request.');
  }
});
```

## Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
