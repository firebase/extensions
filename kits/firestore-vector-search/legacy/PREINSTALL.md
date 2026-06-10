Use this extension to automatically embed and query your Firestore documents with the new vector search feature!

When you install this extension you specify a collection and a document field name. Adding or updating a document with this field triggers this extension to calculate a vector embedding for the document.

This vector embedding is written back to the same document, and the document is indexed in the vector store, ready to be queried against.

The extension currently provides two ways to query:

1. A callable function which takes `query`, `limit` and `prefilter` parameters

2. In a predetermined collection (see instructions after install for the collection path) the results of the query will be written back to documents added here (with `query` and `limit` and `prefilter` fields).

## Index management with the index document

On installation you will be asked to provide the name of a firestore collection to keep metadata on indexes. The extension will create an index document in this collection. Upon configuring the extension (e.g to use a different model) this document will be checked to see if embeddings need updating in backfill.

### Backfill

This extension uses distributed tasks to backfill a collection and embed existing documents if this feature is enabled.

### Misc

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

### Vertex AI Embeddings Preview

This product or feature is subject to the "Pre-GA Offerings Terms" in the General Service Terms section of the [Service Specific Terms](https://cloud.google.com/terms/service-terms#1). Pre-GA products and features are available "as is" and might have limited support. For more information, see the [launch stage descriptions](https://cloud.google.com/products?hl=en#product-launch-stages).

### AI-powered vector search with Genkit

This extension leverages the [Genkit SDK](https://genkit.dev) to generate vector embeddings for your Firestore documents using Gemini models from Google AI and Vertex AI. Genkit streamlines embedding generation, index management, and querying—enabling scalable, efficient semantic search directly integrated with Firestore.

For more details, visit the [Genkit documentation](https://genkit.dev).

### Billing

To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
