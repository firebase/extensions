# Export Collections to BigQuery

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Sends realtime, incremental updates from a specified Cloud Firestore collection to BigQuery.



**Details**: Use this extension to export the documents in a Cloud Firestore collection to BigQuery. Exports are realtime and incremental, so the data in BigQuery is a mirror of your content in Cloud Firestore.

The extension creates and updates a [dataset](https://cloud.google.com/bigquery/docs/datasets-intro) containing the following two BigQuery resources:

- A [table](https://cloud.google.com/bigquery/docs/tables-intro) of raw data that stores a full change history of the documents within your collection. This table includes a number of metadata fields so that BigQuery can display the current state of your data. The principle metadata fields are `timestamp`, `document_name`, and the `operation` for the document change.
- A [view](https://cloud.google.com/bigquery/docs/views-intro) which represents the current state of the data within your collection. It also shows a log of the latest `operation` for each document (`CREATE`, `UPDATE`, or `IMPORT`).

If you create, update, delete, or import a document in the specified collection, this extension sends that update to BigQuery. You can then run queries on this mirrored dataset.

Note that this extension only listens for _document_ changes in the collection, but not changes in any _subcollection_. You can, though, install additional instances of this extension to specifically listen to a subcollection or other collections in your database. Or if you have the same subcollection across documents in a given collection, you can use `{wildcard}` notation to listen to all those subcollections (for example: `chats/{chatid}/posts`).

#### Additional setup

Before installing this extension, you'll need to:

- [Set up Cloud Firestore in your Firebase project.](https://firebase.google.com/docs/firestore/quickstart)
- [Link your Firebase project to BigQuery.](https://support.google.com/firebase/answer/6318765)

#### Backfill your BigQuery dataset

This extension only sends the content of documents that have been changed -- it does not export your full dataset of existing documents into BigQuery. So, to backfill your BigQuery dataset with all the documents in your collection, you can run the [import script](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/IMPORT_EXISTING_DOCUMENTS.md) provided by this extension.

**Important:** Run the import script over the entire collection _after_ installing this extension, otherwise all writes to your database during the import might be lost.

#### Generate schema views

After your data is in BigQuery, you can run the [schema-views script](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/GENERATE_SCHEMA_VIEWS.md) (provided by this extension) to create views that make it easier to query relevant data. You only need to provide a JSON schema file that describes your data structure, and the schema-views script will create the views.

#### Billing
 
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)
 
- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s free tier:
  - BigQuery (this extension writes to BigQuery with [streaming inserts](https://cloud.google.com/bigquery/pricing#streaming_pricing))
  - Cloud Firestore
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#expandable-24))



**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension?  You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* BigQuery Dataset location: Where do you want to deploy the BigQuery dataset created for this extension? For help selecting a location, refer to the [location selection guide](https://cloud.google.com/bigquery/docs/locations).

* Collection path: What is the path of the collection that you would like to export? You may use `{wildcard}` notation to match a subcollection of all documents in a collection (for example: `chatrooms/{chatid}/posts`).

* Dataset ID: What ID would you like to use for your BigQuery dataset? This extension will create the dataset, if it doesn't already exist.

* Table ID: What identifying prefix would you like to use for your table and view inside your BigQuery dataset? This extension will create the table and view, if they don't already exist.



**Cloud Functions:**

* **fsexportbigquery:** Listens for document changes in your specified Cloud Firestore collection, then exports the changes into BigQuery.



**APIs Used**:

* bigquery-json.googleapis.com (Reason: Mirrors data from your Cloud Firestore collection in BigQuery.)



**Access Required**:



This extension will operate with the following project IAM roles:

* bigquery.dataEditor (Reason: Allows the extension to configure and export data into BigQuery.)
