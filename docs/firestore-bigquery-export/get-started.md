# Get started

## Using the BigQuery extension

The Big Query extension (`firestore-bigquery-export`) lets you automatically mirror documents in a Cloud Firestore collection to [BigQuery](https://cloud.google.com/bigquery). Adding a document to the collection triggers the extension to write a new row to a dataset containing a [table](https://cloud.google.com/bigquery/docs/tables-intro) and [view](https://cloud.google.com/bigquery/docs/views-intro).

The extension supports the following features:

- Mirroring subcollections (using wildcards)
- Data partitioning
- Clustering
- Custom data transformer functions

This extension also includes tooling to assist with generation of SQL schemas from a Cloud Firestore collection and backfilling data from an existing collection.

## Pre-installation setup

TODO - are there any steps required? The extension enables big query for you

## Install the extension

To install the extension, follow the steps on the [Install a Firebase Extension](https://firebase.google.com/docs/extensions/install-extensions)
 page. In summary, do one of the following:

- **Firebase console:** Click the following button:

  BUTTON

- **CLI:** Run the following command:

  ```js
  firebase ext:install firebase/firestore-bigquery-export --project=projectId-or-alias
  ```

During installation, you will be prompted to specify a number of configuration parameters:

- **Cloud Functions location:**

  Select the location of where you want to deploy the functions created for this extension. You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

- **BigQuery Dataset location:**

  Where do you want to deploy the BigQuery dataset created for this extension? For help selecting a location, refer to the [location selection guide](https://cloud.google.com/bigquery/docs/locations).

- **Project Id:**

  Override the default project bigquery instance. This can allow updates to be directed to a bigquery instance on another project.

- **Collection Path:**

  What is the path of the collection that you would like to mirror to BigQuery? (for example: `chatrooms`).

  If you wish to mirror documents from subcollections, you may use the `{wildcard}` notation to listen to all those subcollections (for example: `chats/{chatid}/posts`). Note that this extension does not support listening for document changes across _any_ subcollection. You can, though, install additional instances of this extension to specifically listen to a subcollection or other collections in your database.

- **Wildcard Column field with Parent Firestore Document IDs:**

  If you provided any `{wildcard}` fields to the **Collection Path** configuration parameter, you select whether you wish those parameters to be returned within a `path_params` column.

  If selected, parent Firestore Document IDs from `{wildcards}` will be returned in the column as a JSON formatted string.

- **Dataset ID:**

  The BigQuery dataset ID which the extension will use. The extension will create the dataset if it does not already exist.

- **Table ID:**

  What identifying prefix would you like to use for your table and view
  inside your BigQuery dataset? This extension will create the table and the
  view if they don't already exist.

- **BigQuery SQL table Time Partitioning option type:**

  This parameter will allow you to partition the BigQuery table and BigQuery view
  created by the extension based on data ingestion time. You may select the granularity of
  partitioning based upon one of: HOUR, DAY, MONTH, YEAR. This will
  generate one partition per day, hour, month, or year, respectively.

- **BigQuery Time Partitioning column name:**

  BigQuery table column/schema field name for TimePartitioning. You can choose schema available as `timestamp` OR a new custom-defined column that will be assigned to the selected Firestore Document field below. Defaults to pseudo column `_PARTITIONTIME` if unspecified. Cannot be changed if the Table is already partitioned.

- **Firestore Document field name for BigQuery SQL Time Partitioning field option:**

  This parameter will allow you to partition the BigQuery table created by the extension based on the selected. The Firestore Document field value must be a top-level TIMESTAMP, DATETIME, DATE field BigQuery string format, or Firestore timestamp(will be converted to BigQuery TIMESTAMP). Cannot be changed if the Table is already partitioned.

- **BigQuery SQL Time Partitioning table schema field(column) type:**
  Parameter for BigQuery SQL schema field type for the selected Time Partitioning Firestore Document field option. Cannot be changed if the Table is already partitioned.
- **BigQuery SQL table clustering:**

  This parameter will allow you to set up Clustering for the BigQuery Table
  created by the extension. (for example: `data,document_id,timestamp`- no whitespaces). You can select up to 4 comma-separated fields(order matters).
  Available schema extensions table fields for clustering: `document_id, document_name, timestamp, event_id, operation, data`.

- **Backup Collection Name:**

  This (optional) parameter will allow you to specify a collection to which failed BigQuery updates will be written.

- **Transform function URL:**

  Specify a function URL to call that will transform the payload that will be written to BigQuery.

## Use the extension

After installation, this extension monitors all document writes to the collection you configured.

The extension maintains a table and a view in the specified dataset:

- `{tableId}_raw_changelog`
  - The change-log table stores records of every document-write within the collection. This table keeps a record of all write events, such as whether a record was created, updated, or deleted along with the additional information such as a timestamp, path parameters (if enabled), the change type, document ID, and name.
- `{tableId}_raw_latest`
  - The latest view is a reflection of the current data stored within the collection. If a document is created, a new record in the view is added. If a document is updated, the row within the view will be modified to reflect the latest document snapshot data. If a document is removed, the record will be removed from the view.

## Advanced use

Learn about the advanced use of this extension:

- [Generating SQL Schemas](https://www.notion.so/Generating-Schemas-2a42ca95fa624215b1cd06d88d71aaa8)
- [Import existing data](https://www.notion.so/Importing-Data-12e450250cde4fbc844e13eafbe32e14)
- [Wildcards](https://www.notion.so/Wildcards-2e43ed6a3e0c45a584a2a49d61f31aec)
- [Partitioning](https://www.notion.so/Partitioning-6aee582404a1475eaed6e40db374e635)
- [Clustering](https://www.notion.so/Clustering-998244364c6a46b5951133af87fd17fd)
- [Cross-project support](https://www.notion.so/Cross-Project-Support-6f160a02142f48bfb120539673b224e0)
- [Transforming data](https://www.notion.so/Transforming-Data-f5a777dae51e457a930d5cd93a04795d)
