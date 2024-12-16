# Stream Firestore to BigQuery

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Sends realtime, incremental updates from a specified Cloud Firestore collection to BigQuery.



**Details**: Use this extension to export the documents in a Cloud Firestore collection to BigQuery. Exports are realtime and incremental, so the data in BigQuery is a mirror of your content in Cloud Firestore.

The extension creates and updates a [dataset](https://cloud.google.com/bigquery/docs/datasets-intro) containing the following two BigQuery resources:

- A [table](https://cloud.google.com/bigquery/docs/tables-intro) of raw data that stores a full change history of the documents within your collection. This table includes a number of metadata fields so that BigQuery can display the current state of your data. The principle metadata fields are `timestamp`, `document_name`, and the `operation` for the document change.
- A [view](https://cloud.google.com/bigquery/docs/views-intro) which represents the current state of the data within your collection. It also shows a log of the latest `operation` for each document (`CREATE`, `UPDATE`, or `IMPORT`).

*Warning*: A BigQuery table corresponding to your configuration will be automatically generated upon installing or updating this extension. Manual table creation may result in discrepancies with your configured settings.

If you create, update, or delete a document in the specified collection, this extension sends that update to BigQuery. You can then run queries on this mirrored dataset.

Note that this extension only listens for _document_ changes in the collection, but not changes in any _subcollection_. You can, though, install additional instances of this extension to specifically listen to a subcollection or other collections in your database. Or if you have the same subcollection across documents in a given collection, you can use `{wildcard}` notation to listen to all those subcollections (for example: `chats/{chatid}/posts`). 

Enabling wildcard references will provide an additional STRING based column. The resulting JSON field value references any wildcards that are included in ${param:COLLECTION_PATH}. You can extract them using [JSON_EXTRACT_SCALAR](https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_extract_scalar).


`Partition` settings cannot be updated on a pre-existing table, if these options are required then a new table must be created.

Note: To enable partitioning for a Big Query database, the following fields are required:

 - Time Partitioning option type
 - Time partitioning column name
 - Time partiitioning table schema
 - Firestore document field name

`Clustering` will not need to create or modify a table when adding clustering options, this will be updated automatically.



#### Additional setup

Before installing this extension, you'll need to:

- [Set up Cloud Firestore in your Firebase project.](https://firebase.google.com/docs/firestore/quickstart)
- [Link your Firebase project to BigQuery.](https://support.google.com/firebase/answer/6318765)


#### Import existing documents

There are two ways to import existing Firestore documents into BigQuery - the backfill feature and the import script.

To import documents that already exist at installation time into BigQuery, answer **Yes** when the installer asks "Import existing Firestore documents into BigQuery?" The extension will export existing documents as part of the installation and update processes.

Alternatively, you can run the external [import script](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/IMPORT_EXISTING_DOCUMENTS.md) to backfill existing documents. If you plan to use this script, answer **No** when prompted to import existing documents.

**Important:** Run the external import script over the entire collection _after_ installing this extension, otherwise all writes to your database during the import might be lost.

If you don't either enable automatic import or run the import script, the extension only exports the content of documents that are created or changed after installation.

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

#### Using Customer Managed Encryption Keys

By default, BigQuery encrypts your content stored at rest. BigQuery handles and manages this default encryption for you without any additional actions on your part.

If you want to control encryption yourself, you can use customer-managed encryption keys (CMEK) for BigQuery. Instead of Google managing the key encryption keys that protect your data, you control and manage key encryption keys in Cloud KMS.

For more general information on this, see [the docs](https://cloud.google.com/bigquery/docs/customer-managed-encryption).

To use CMEK and the Key Management Service (KMS) with this extension
1. [Enable the KMS API in your Google Cloud Project](https://console.cloud.google.com/apis/enableflow?apiid=cloudkms.googleapis.com).
2. Create a keyring and keychain in the KMS. Note that the region of the keyring and key *must* match the region of your bigquery dataset
3. Grant the BigQuery service account permission to encrypt and decrypt using that key. The Cloud KMS CryptoKey Encrypter/Decrypter role grants this permission. First find your project number. You can find this for example on the cloud console dashboard `https://console.cloud.google.com/home/dashboard?project={PROJECT_ID}`. The service account which needs the Encrypter/Decrypter role is then `bq-PROJECT_NUMBER@bigquery-encryption.iam.gserviceaccount.com`. You can grant this role through the credentials service in the console, or through the CLI:
```
gcloud kms keys add-iam-policy-binding \
--project=KMS_PROJECT_ID \
--member serviceAccount:bq-PROJECT_NUMBER@bigquery-encryption.iam.gserviceaccount.com \
--role roles/cloudkms.cryptoKeyEncrypterDecrypter \
--location=KMS_KEY_LOCATION \
--keyring=KMS_KEY_RING \
KMS_KEY
```
4. When installing this extension, enter the resource name of your key. It will look something like the following:
```
projects/<YOUR PROJECT ID>/locations/<YOUR REGION>/keyRings/<YOUR KEY RING NAME>/cryptoKeys/<YOUR KEY NAME>
```
If you follow these steps, your changelog table should be created using your customer-managed encryption.

#### Generate schema views

After your data is in BigQuery, you can run the [schema-views script](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/GENERATE_SCHEMA_VIEWS.md) (provided by this extension) to create views that make it easier to query relevant data. You only need to provide a JSON schema file that describes your data structure, and the schema-views script will create the views.

#### Cross-project Streaming

By default, the extension exports data to BigQuery in the same project as your Firebase project. However, you can configure it to export to a BigQuery instance in a different Google Cloud project. To do this:

1. During installation, set the `BIGQUERY_PROJECT_ID` parameter to your target BigQuery project ID.

2. After installation, you'll need to grant the extension's service account the necessary BigQuery permissions on the target project. You can use our provided scripts:

**For Linux/Mac (Bash):**
```bash
curl -O https://raw.githubusercontent.com/firebase/extensions/master/firestore-bigquery-export/scripts/grant-crossproject-access.sh
chmod +x grant-crossproject-access.sh
./grant-crossproject-access.sh -f SOURCE_FIREBASE_PROJECT -b TARGET_BIGQUERY_PROJECT [-i EXTENSION_INSTANCE_ID]
```

**For Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/firebase/extensions/master/firestore-bigquery-export/scripts/grant-crossproject-access.ps1" -OutFile "grant-crossproject-access.ps1"
.\grant-crossproject-access.ps1 -FirebaseProject SOURCE_FIREBASE_PROJECT -BigQueryProject TARGET_BIGQUERY_PROJECT [-ExtensionInstanceId EXTENSION_INSTANCE_ID]
```

**Parameters:**
For Bash script:
- `-f`: Your Firebase (source) project ID
- `-b`: Your target BigQuery project ID
- `-i`: (Optional) Extension instance ID if different from default "firestore-bigquery-export"

For PowerShell script:
- `-FirebaseProject`: Your Firebase (source) project ID
- `-BigQueryProject`: Your target BigQuery project ID
- `-ExtensionInstanceId`: (Optional) Extension instance ID if different from default "firestore-bigquery-export"

**Prerequisites:**
- You must have the [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and configured
- You must have permission to grant IAM roles on the target BigQuery project
- The extension must be installed before running the script

**Note:** If extension installation is failing to create a dataset on the target project initially due to missing permissions, don't worry. The extension will automatically retry once you've granted the necessary permissions using these scripts.

#### Billing
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
  - BigQuery (this extension writes to BigQuery with [streaming inserts](https://cloud.google.com/bigquery/pricing#streaming_pricing))
  - Cloud Firestore
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))



**Configuration Parameters:**

* BigQuery Dataset location: Where do you want to deploy the BigQuery dataset created for this extension? For help selecting a location, refer to the [location selection guide](https://cloud.google.com/bigquery/docs/locations).

* BigQuery Project ID: Override the default project for BigQuery instance. This can allow updates to be directed to to a BigQuery instance on another GCP project.

* Collection path: What is the path of the collection that you would like to export? You may use `{wildcard}` notation to match a subcollection of all documents in a collection (for example: `chatrooms/{chatid}/posts`). Parent Firestore Document IDs from `{wildcards}`  can be returned in `path_params` as a JSON formatted string.

* Enable Wildcard Column field with Parent Firestore Document IDs: If enabled, creates a column containing a JSON object of all wildcard ids from a documents path.

* Dataset ID: What ID would you like to use for your BigQuery dataset? This extension will create the dataset, if it doesn't already exist.

* Table ID: What identifying prefix would you like to use for your table and view inside your BigQuery dataset? This extension will create the table and view, if they don't already exist.

* BigQuery SQL table Time Partitioning option type: This parameter will allow you to partition the BigQuery table and BigQuery view  created by the extension based on data ingestion time. You may select the granularity of partitioning based upon one of: HOUR, DAY, MONTH, YEAR. This will generate one partition per day, hour, month or year, respectively.

* BigQuery Time Partitioning column name: BigQuery table column/schema field name for TimePartitioning. You can choose schema available as `timestamp` OR a new custom defined column that will be assigned to the selected Firestore Document field below. Defaults to pseudo column _PARTITIONTIME if unspecified. Cannot be changed if Table is already partitioned.

* Firestore Document field name for BigQuery SQL Time Partitioning field option: This parameter will allow you to partition the BigQuery table  created by the extension based on selected. The Firestore Document field value must be a top-level TIMESTAMP, DATETIME, DATE field BigQuery string format or Firestore timestamp(will be converted to BigQuery TIMESTAMP). Cannot be changed if Table is already partitioned.
 example: `postDate`(Ensure that the Firestore-BigQuery export extension
creates the dataset and table before initiating any backfill scripts.
 This step is crucial for the partitioning to function correctly. It is
essential for the script to insert data into an already partitioned table.)

* BigQuery SQL Time Partitioning table schema field(column) type: Parameter for BigQuery SQL schema field type for the selected Time Partitioning Firestore Document field option. Cannot be changed if Table is already partitioned.

* BigQuery SQL table clustering: This parameter will allow you to set up Clustering for the BigQuery Table created by the extension. (for example: `data,document_id,timestamp`- no whitespaces). You can select up to 4 comma separated fields. The order of the specified columns determines the sort order of the data. Available schema extensions table fields for clustering: `document_id, document_name, timestamp, event_id, operation, data`.

* Maximum number of synced documents per second: This parameter will set the maximum number of syncronised documents per second with BQ. Please note, any other external updates to a Big Query table will be included within this quota. Ensure that you have a set a low enough number to compensate. Defaults to 10.

* Backup Collection Name: This (optional) parameter will allow you to specify a collection for which failed BigQuery updates will be written to.

* Transform function URL: Specify a function URL to call that will transform the payload that will be written to BigQuery. See the pre-install documentation for more details.

* Use new query syntax for snapshots: If enabled, snapshots will be generated with the new query syntax, which should be more performant, and avoid potential resource limitations.

* Exclude old data payloads: If enabled, table rows will never contain old data (document snapshot before the Firestore onDocumentUpdate event: `change.before.data()`). The reduction in data should be more performant, and avoid potential resource limitations.

* Cloud KMS key name: Instead of Google managing the key encryption keys that protect your data, you control and manage key encryption keys in Cloud KMS. If this parameter is set, the extension will specify the KMS key name when creating the BQ table. See the PREINSTALL.md for more details.

* Maximum number of enqueue attempts: This parameter will set the maximum number of attempts to enqueue a document to cloud tasks for export to BigQuery.



**Cloud Functions:**

* **fsexportbigquery:** Listens for document changes in your specified Cloud Firestore collection, then exports the changes into BigQuery.

* **syncBigQuery:** A task-triggered function that gets called on BigQuery sync

* **initBigQuerySync:** Runs configuration for sycning with BigQuery

* **setupBigQuerySync:** Runs configuration for sycning with BigQuery



**APIs Used**:

* bigquery.googleapis.com (Reason: Mirrors data from your Cloud Firestore collection in BigQuery.)



**Access Required**:



This extension will operate with the following project IAM roles:

* bigquery.dataEditor (Reason: Allows the extension to configure and export data into BigQuery.)

* datastore.user (Reason: Allows the extension to write updates to the database.)
