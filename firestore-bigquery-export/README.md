# Export Collections to BigQuery

**Description**: Sends realtime, incremental updates from a specified Cloud Firestore collection to BigQuery.



**Details**: Use this extension to export the documents in a Cloud Firestore collection to BigQuery. Exports are realtime and incremental, so the data in BigQuery is a mirror of your content in Cloud Firestore.

The extension creates and updates a [dataset](https://cloud.google.com/bigquery/docs/datasets-intro) containing the following two BigQuery resources:

+   A [table](https://cloud.google.com/bigquery/docs/tables-intro) of raw data that stores a full change history of the documents within your collection. This table includes a number of metadata fields so that BigQuery can display the current state of your data. The principle metadata fields are `timestamp`, `document_name`, and the `operation` for the document change.
+   A [view](https://cloud.google.com/bigquery/docs/views-intro) which represents the current state of the data within your collection. It also shows a log of the latest `operation` for each document (`CREATE`, `UPDATE`, or `IMPORT`).

If you create, update, delete, or import a document in the specified collection, this extension sends that update to BigQuery. You can then run queries on this mirrored dataset.

Note that this extension only listens for _document_ changes in the collection, but not changes in any _subcollection_. You can, though, install additional instances of this extension to specifically listen to a subcollection or other collections in your database. Or if you have the same subcollection across documents in a given collection, you can use `{wildcard}` notation to listen to all those subcollections (for example: `chats/{chatid}/posts`).

#### Additional setup

Before installing this extension, you'll need to:

+   [Set up Cloud Firestore in your Firebase project.](https://firebase.google.com/docs/firestore/quickstart)
+   [Link your Firebase project to BigQuery.](https://support.google.com/firebase/answer/6318765)

This extension only sends the content of documents that have been changed -- it does not export your full dataset of existing documents into BigQuery. So, to backfill your BigQuery dataset with all the documents in your collection, you can run the import script provided by this extension.

**Important:** Run the script over the entire collection _after_ installing this extension, otherwise all writes to your database during the import might be lost.

Learn more about using this script to [backfill your existing collection](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/IMPORT_EXISTING_DOCUMENTS.md).

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

+   Cloud Firestore
+   BigQuery
+   Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)




**Configuration Parameters:**

* Deployment location: Where should the extension be deployed? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations#selecting_regions_for_firestore_and_storage).

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
