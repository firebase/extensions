# Stream Collections to BigQuery

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Sends realtime, incremental updates from a specified Cloud Firestore collection to BigQuery.



**Details**: Use this extension to export the documents in a Cloud Firestore collection to BigQuery. Exports are realtime and incremental, so the data in BigQuery is a mirror of your content in Cloud Firestore.

The extension creates and updates a [dataset](https://cloud.google.com/bigquery/docs/datasets-intro) containing the following two BigQuery resources:

- A [table](https://cloud.google.com/bigquery/docs/tables-intro) of raw data that stores a full change history of the documents within your collection. This table includes a number of metadata fields so that BigQuery can display the current state of your data. The principle metadata fields are `timestamp`, `document_name`, and the `operation` for the document change.
- A [view](https://cloud.google.com/bigquery/docs/views-intro) which represents the current state of the data within your collection. It also shows a log of the latest `operation` for each document (`CREATE`, `UPDATE`, or `IMPORT`).

If you create, update, delete, or import a document in the specified collection, this extension sends that update to BigQuery. You can then run queries on this mirrored dataset.

Note that this extension only listens for _document_ changes in the collection, but not changes in any _subcollection_. You can, though, install additional instances of this extension to specifically listen to a subcollection or other collections in your database. Or if you have the same subcollection across documents in a given collection, you can use `{wildcard}` notation to listen to all those subcollections (for example: `chats/{chatid}/posts`). 

Enabling wildcard references will provide an additional STRING based column. The resulting JSON field value references any wildcards that are included in ${param:COLLECTION_PATH}. You can extract them using [JSON_EXTRACT_SCALAR](https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_extract_scalar).


`Partition` settings cannot be updated on a pre-existing table, if these options are required then a new table must be created.

`Clustering` will not need to create or modify a table when adding clustering options, this will be updated automatically.



#### Additional setup

Before installing this extension, you'll need to:

- [Set up Cloud Firestore in your Firebase project.](https://firebase.google.com/docs/firestore/quickstart)
- [Link your Firebase project to BigQuery.](https://support.google.com/firebase/answer/6318765)

#### Transform function

Prior to sending the document change to BigQuery, you have an opportunity to transform the data with an HTTP function. The payload will contain the following:

```
{ 
  data: [{
    insertId: int;
    json: {
      timestamp: int;
      event_id: int;
      document_name: string;
      document_id: int;
      operation: ChangeType;
      data: string;
    },
  }]
}
```

The response should be indentical in structure.

#### Backfill your BigQuery dataset

To import documents that already exist at installation time into BigQuery, answer **Yes** when the installer asks "Import existing Firestore documents into BigQuery?" The extension will export existing documents as part of the installation and update processes.

Alternatively, you can run the external [import script](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/IMPORT_EXISTING_DOCUMENTS.md) to backfill existing documents. If you plan to use this script, answer **No** when prompted to import existing documents.

**Important:** Run the external import script over the entire collection _after_ installing this extension, otherwise all writes to your database during the import might be lost.

If you don't either enable automatic import or run the import script, the extension only exports the content of documents that are created or changed after installation.

#### Generate schema views

After your data is in BigQuery, you can run the [schema-views script](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/GENERATE_SCHEMA_VIEWS.md) (provided by this extension) to create views that make it easier to query relevant data. You only need to provide a JSON schema file that describes your data structure, and the schema-views script will create the views.

#### Billing
 
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)
 
- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
  - BigQuery (this extension writes to BigQuery with [streaming inserts](https://cloud.google.com/bigquery/pricing#streaming_pricing))
  - Cloud Firestore
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))



**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension?  You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* BigQuery Dataset location: Where do you want to deploy the BigQuery dataset created for this extension? For help selecting a location, refer to the [location selection guide](https://cloud.google.com/bigquery/docs/locations).

* Project Id: Override the default project bigquery instance. This can allow updates to be directed to a bigquery instance on another project.

* Collection path: What is the path of the collection that you would like to export? You may use `{wildcard}` notation to match a subcollection of all documents in a collection (for example: `chatrooms/{chatid}/posts`). Parent Firestore Document IDs from `{wildcards}`  can be returned in `path_params` as a JSON formatted string.

* Wildcard Column field with Parent Firestore Document IDs: Creates a column containing a JSON object of all wildcard ids from a documents path.

* Dataset ID: What ID would you like to use for your BigQuery dataset? This extension will create the dataset, if it doesn't already exist.

* Table ID: What identifying prefix would you like to use for your table and view inside your BigQuery dataset? This extension will create the table and view, if they don't already exist.

* BigQuery SQL table Time Partitioning option type: This parameter will allow you to partition the BigQuery table and BigQuery view  created by the extension based on data ingestion time. You may select the granularity of partitioning based upon one of: HOUR, DAY, MONTH, YEAR. This will generate one partition per day, hour, month or year, respectively.

* BigQuery Time Partitioning column name: BigQuery table column/schema field name for TimePartitioning. You can choose schema available as `timestamp` OR new custom defined column that will be assigned to the selected Firestore Document field below. Defaults to pseudo column _PARTITIONTIME if unspecified. Cannot be changed if Table is already partitioned.

* Firestore Document field name for BigQuery SQL Time Partitioning field option: This parameter will allow you to partition the BigQuery table  created by the extension based on selected. The Firestore Document field value must be a top-level TIMESTAMP, DATETIME, DATE field BigQuery string format or Firestore timestamp(will be converted to BigQuery TIMESTAMP). Cannot be changed if Table is already partitioned.
 example: `postDate`

* BigQuery SQL Time Partitioning table schema field(column) type: Parameter for BigQuery SQL schema field type for the selected Time Partitioning Firestore Document field option. Cannot be changed if Table is already partitioned.

* BigQuery SQL table clustering: This parameter will allow you to set up Clustering for the BigQuery Table created by the extension. (for example: `data,document_id,timestamp`- no whitespaces). You can select up to 4 comma separated fields. The order of the specified columns determines the sort order of the data. Available schema extensions table fields for clustering: `document_id, timestamp, event_id, operation, data`.

* Backup Collection Name: This (optional) parameter will allow you to specify a collection for which failed BigQuery updates will be written to.

* Transform function URL: Specify a function URL to call that will transform the payload that will be written to BigQuery. See the pre-install documentation for more details.

* Import existing Firestore documents into BigQuery: Do you want to import existing documents from your Firestore collection into BigQuery? These documents  will have each have a special changelog with the operation of `IMPORT` and the timestamp of epoch. This ensures that any operation on an imported document supersedes the import record.

* Existing documents collection: What is the path of the the Cloud Firestore Collection you would like to import from? (This may, or may not, be the same Collection for which you plan to mirror changes.)

* Docs per backfill: When importing existing documents, how many should be imported at once? The default value of 200 should be ok for most users. If you are using a transform function or have very large documents, you may need to set this to a lower number.



**Cloud Functions:**

* **fsexportbigquery:** Listens for document changes in your specified Cloud Firestore collection, then exports the changes into BigQuery.

* **fsimportexistingdocs:** Imports exisitng documents in ${param:IMPORT_COLLECTION_PATH} into BigQuery. Imported documents will have a special changelog with the operation of `IMPORT` and the timestamp of epoch.



**APIs Used**:

* bigquery.googleapis.com (Reason: Mirrors data from your Cloud Firestore collection in BigQuery.)



**Access Required**:



This extension will operate with the following project IAM roles:

* bigquery.dataEditor (Reason: Allows the extension to configure and export data into BigQuery.)

* datastore.user (Reason: Allows the extension to write updates to the database.)
