### See it in action

You can test out this extension right away!

1.  Go to your [Cloud Firestore dashboard](https://console.firebase.google.com/project/${param:BIGQUERY_PROJECT_ID}/firestore/data) in the Firebase console.

2.  If it doesn't already exist, create the collection you specified during installation: `${param:COLLECTION_PATH}`

3.  Create a document in the collection called `bigquery-mirror-test` that contains any fields with any values that you'd like.

4.  Go to the [BigQuery web UI](https://console.cloud.google.com/bigquery?project=${param:BIGQUERY_PROJECT_ID}&p=${param:BIGQUERY_PROJECT_ID}&d=${param:DATASET_ID}) in the Google Cloud Platform console.

5.  Query your **raw changelog table**, which should contain a single log of creating the `bigquery-mirror-test` document.

    ```
    SELECT *
    FROM `${param:BIGQUERY_PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_ID}_raw_changelog`
    ```

6.  Query your **latest view**, which should return the latest change event for the only document present -- `bigquery-mirror-test`.

    ```
    SELECT *
    FROM `${param:BIGQUERY_PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_ID}_raw_latest`
    ```

7.  Delete the `bigquery-mirror-test` document from [Cloud Firestore](https://console.firebase.google.com/project/${param:BIGQUERY_PROJECT_ID}/firestore/data).
    The `bigquery-mirror-test` document will disappear from the **latest view** and a `DELETE` event will be added to the **raw changelog table**.

8.  You can check the changelogs of a single document with this query:

    ```
    SELECT *
    FROM `${param:BIGQUERY_PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_ID}_raw_changelog`
    WHERE document_name = "bigquery-mirror-test"
    ORDER BY TIMESTAMP ASC
    ```

### Using the extension

Whenever a document is created, updated, imported, or deleted in the specified collection, this extension sends that update to BigQuery. You can then run queries on this mirrored dataset which contains the following resources:

- **raw changelog table:** [`${param:TABLE_ID}_raw_changelog`](https://console.cloud.google.com/bigquery?project=${param:BIGQUERY_PROJECT_ID}&p=${param:BIGQUERY_PROJECT_ID}&d=${param:DATASET_ID}&t=${param:TABLE_ID}_raw_changelog&page=table)
- **latest view:** [`${param:TABLE_ID}_raw_latest`](https://console.cloud.google.com/bigquery?project=${param:BIGQUERY_PROJECT_ID}&p=${param:BIGQUERY_PROJECT_ID}&d=${param:DATASET_ID}&t=${param:TABLE_ID}_raw_latest&page=table)

To review the schema for these two resources, click the **Schema** tab for each resource in BigQuery.

Note that this extension only listens for _document_ changes in the collection, but not changes in any _subcollection_. You can, though, install additional instances of this extension to specifically listen to a subcollection or other collections in your database. Or if you have the same subcollection across documents in a given collection, you can use `{wildcard}` notation to listen to all those subcollections (for example: `chats/{chatid}/posts`).

Enabling wildcard references will provide an additional STRING based column. The resulting JSON field value references any wildcards that are included in ${param:COLLECTION_PATH}. You can extract them using [JSON_EXTRACT_SCALAR](https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions#json_extract_scalar).


`Partition` settings cannot be updated on a pre-existing table, if these options are required then a new table must be created.

`Clustering` will not need to create or modify a table when adding clustering options, this will be updated automatically.

#### Cross-project Streaming

By default, the extension exports data to BigQuery in the same project as your Firebase project. However, you can configure it to export to a BigQuery instance in a different Google Cloud project. To do this:

1. During installation, set the `BIGQUERY_PROJECT_ID` parameter as your target BigQuery project ID.

2. Identify the service account on the source project associated with the extension. By default, it will be constructed as `ext-<extension-instance-id>@project-id.iam.gserviceaccount.com`. However, if the extension instance ID is too long, it may be truncated and 4 random characters appended to abide by service account length limits.

3. To find the exact service account, navigate to IAM & Admin -> IAM in the Google Cloud Platform Console. Look for the service account listed with "Name" as "Firebase Extensions <your extension instance ID> service account". The value in the "Principal" column will be the service account that needs permissions granted in the target project.

4. Grant the extension's service account the necessary BigQuery permissions on the target project. You can use our provided scripts:

**For Linux/Mac (Bash):**
```bash
curl -O https://raw.githubusercontent.com/firebase/extensions/master/firestore-bigquery-export/scripts/grant-crossproject-access.sh
chmod +x grant-crossproject-access.sh
./grant-crossproject-access.sh -f SOURCE_FIREBASE_PROJECT -b TARGET_BIGQUERY_PROJECT [-i EXTENSION_INSTANCE_ID] [-s SERVICE_ACCOUNT]
```

**For Windows (PowerShell):**
```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/firebase/extensions/master/firestore-bigquery-export/scripts/grant-crossproject-access.ps1" -OutFile "grant-crossproject-access.ps1"
.\grant-crossproject-access.ps1 -FirebaseProject SOURCE_FIREBASE_PROJECT -BigQueryProject TARGET_BIGQUERY_PROJECT [-ExtensionInstanceId EXTENSION_INSTANCE_ID] [-ServiceAccount SERVICE_ACCOUNT]
```

**Parameters:**
For Bash script:
- `-f`: Your Firebase (source) project ID
- `-b`: Your target BigQuery project ID
- `-i`: (Optional) Extension instance ID if different from default "firestore-bigquery-export"
- `-s`: (Optional) Service account email. If not provided, it will be constructed using the extension instance ID

For PowerShell script:
- `-FirebaseProject`: Your Firebase (source) project ID
- `-BigQueryProject`: Your target BigQuery project ID
- `-ExtensionInstanceId`: (Optional) Extension instance ID if different from default "firestore-bigquery-export"
- `-ServiceAccount`: (Optional) Service account email. If not provided, it will be constructed using the extension instance ID

**Prerequisites:**
- You must have the [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and configured
- You must have permission to grant IAM roles on the target BigQuery project
- The extension must be installed before running the script

**Note:** If extension installation is failing to create a dataset on the target project initially due to missing permissions, don't worry. The extension will automatically retry once you've granted the necessary permissions using these scripts.

### _(Optional)_ Import existing documents

If you chose _not_ to automatically import existing documents when you installed this extension, you can backfill your BigQuery dataset with all the documents in your collection using the import script.

If you don't either enable automatic import or run the import script, the extension only exports the content of documents that are created or changed after installation.

The import script can read all existing documents in a Cloud Firestore collection and insert them into the raw changelog table created by this extension. The script adds a special changelog for each document with the operation of `IMPORT` and the timestamp of epoch. This is to ensure that any operation on an imported document supersedes the `IMPORT`.

**Warning:** Make sure to not run the import script if you enabled automatic backfill during the extension installation, as it might result in data loss.

**Important:** Run the import script over the entire collection _after_ installing this extension, otherwise all writes to your database during the import might be lost.

Learn more about using the import script to [backfill your existing collection](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/IMPORT_EXISTING_DOCUMENTS.md).

### _(Optional)_ Generate schema views

After your data is in BigQuery, you can use the schema-views script (provided by this extension) to create views that make it easier to query relevant data. You only need to provide a JSON schema file that describes your data structure, and the schema-views script will create the views.

Learn more about using the schema-views script to [generate schema views](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/GENERATE_SCHEMA_VIEWS.md).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
