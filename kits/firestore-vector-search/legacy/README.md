# Vector Search with Firestore

**Author**: Google Cloud (**[https://cloud.google.com](https://cloud.google.com)**)

**Description**: Perform vector similarity search with Firestore



**Details**: Use this extension to automatically embed and query your Firestore documents with the new vector search feature!

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




**Configuration Parameters:**

* LLM: Which embedding API do you want to use? Note: **Vertex AI provider** is supported only with the **us-central1** location.


* Gemini API key: If you selected Gemini to calculate embeddings, please provide your Gemini API key


* OpenAI API key: If you selected OpenAI to calculate embeddings, please provide your OpenAI API key


* LLM Function: If you selected \"Other\" as your embedding provider, please provide the URL of your function that will calculate the embeddings.


* LLM Function batch size: If you selected \"Other\" as your embedding provider, please provide the batch size of your function that will calculate the embeddings.


* LLM Function dimension: If you selected \"Other\" as your embedding provider, please provide the dimension of the embedding you will be using.


* Collection path: What is the path to the collection that contains the strings that you want to embed?


* Default query limit: What is the default number of results to return when making a vector search query?


* Distance measure: What distance measure do you want to be used to rank the results of your vector search?

* Input field name: What is the name of the field that contains the string that you want to embed?


* Output field name: What is the name of the field where you want to store your embeddings?


* Status field name: What is the name of the field where you want to track the state of a document being embedded?


* Embed existing documents?: Should existing documents in the Firestore collection be embedded as well?


* Update existing embeddings?: Should existing documents in the Firestore collection be updated with new embeddings on reconfiguring the extensions?


* Cloud Functions location: Where do you want to deploy the functions created for this extension? For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations). Make sure to pick a location supported by the Gemini API, if you have chosen this as your embedding provider.



**Cloud Functions:**

* **updateTrigger:** Queues the document update tasks

* **updateTask:** Performs the embeddings for document updates

* **backfillTrigger:** Queues the backfill tasks

* **backfillTask:** Performs the embeddings for backfill

* **embedOnWrite:** An event-triggered function that gets called when a document is created or updated. It generates embeddings for the document and writes those embeddings back to firestore

* **queryOnWrite:** An event-triggered function that gets called when a document is created or updated. It uses the document fields `query`, `limit`, and `prefilters` to perform a vector search query.

* **queryCallable:** A callable function that queries a firestore collection with vector search



**APIs Used**:

* aiplatform.googleapis.com (Reason: This extension uses the Vertex AI multimodal model for embedding images, if configured to do so.)

* storage-component.googleapis.com (Reason: Needed to use Cloud Storage)



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to write embeddings to Cloud Firestore.)

* aiplatform.user (Reason: This extension requires access to Vertex AI to create, update and query a Vertex Matching Engine index.)

* storage.objectAdmin (Reason: This extension requires access to Cloud Storage to read image data from your Cloud Storage.)

* datastore.indexAdmin (Reason: This extension requires access to Cloud Firestore to create, update and query a Firestore index.)
