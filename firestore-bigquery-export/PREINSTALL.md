Use this extension to export the documents in a Cloud Firestore collection to BigQuery. Exports are realtime and incremental, so the data in BigQuery is a mirror of your content in Cloud Firestore.

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

#### Backfill your BigQuery dataset

This extension only sends the content of documents that have been changed -- it does not export your full dataset of existing documents into BigQuery. So, to backfill your BigQuery dataset with all the documents in your collection, you can run the [import script](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/IMPORT_EXISTING_DOCUMENTS.md) provided by this extension.

**Important:** Run the import script over the entire collection _after_ installing this extension, otherwise all writes to your database during the import might be lost.

#### Generate schema views

After your data is in BigQuery, you can run the [schema-views script](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/GENERATE_SCHEMA_VIEWS.md) (provided by this extension) to create views that make it easier to query relevant data. You only need to provide a JSON schema file that describes your data structure, and the schema-views script will create the views.

#### Billing
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
  - BigQuery (this extension writes to BigQuery with [streaming inserts](https://cloud.google.com/bigquery/pricing#streaming_pricing))
  - Cloud Firestore
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))