### Overview

The import script (`fs-bq-import-collection`) can read all existing documents in a Cloud Firestore collection and insert them into the raw changelog table created by the Export Collections to BigQuery extension. The script adds a special changelog for each document with the operation of `IMPORT` and the timestamp of epoch. This ensures that any operation on an imported document supersedes the import record.

You may pause and resume the script from the last batch at any point.

#### Important notes

+   Run the script over the entire collection **_after_** installing the Export Collections to BigQuery extension; otherwise the writes to your database during the import might not be exported to the dataset.
+   The import script can take up to _O(collection size)_ time to finish. If your collection is large, you might want to consider [loading data from a Cloud Firestore export into BigQuery](https://cloud.google.com/bigquery/docs/loading-data-cloud-firestore).
+   You will see redundant rows in your raw changelog table:

    +   If document changes occur in the time between installing the extension and running this import script.
    +   If you run the import script multiple times over the same collection.

### Install and run the script

This import script uses several values from your installation of the extension:

+   `${PROJECT_ID}`: the project ID for the Firebase project in which you installed the extension
+   `${COLLECTION_PATH}`: the collection path that you specified during extension installation
+   `${DATASET_ID}`: the ID that you specified for your dataset during extension installation

1.  Run `npx @firebaseextensions/fs-bq-import-collection`.

1.  When prompted, enter the Cloud Firestore collection path that you specified during extension installation, `${COLLECTION_PATH}`.

1.  _(Optional)_ You can pause and resume the import at any time:  

    +   **Pause the import:** enter `CTRL+C`  
    The import script records the name of the last successfully imported document in a cursor file called:
    `from-${COLLECTION_PATH}-to-${PROJECT_ID}:${DATASET_ID}:${rawChangeLogName}`,
    which lives in the directory from which you invoked the import script.

    +   **Resume the import from where you left off:** re-run `npx @firebaseextensions/fs-bq-import-collection`
    _from the same directory that you previously invoked the script_

        Note that when an import completes successfully, the import script automatically cleans up the cursor file it was using to keep track of its progress.

1.  In the [BigQuery web UI](https://console.cloud.google.com/bigquery), navigate to the dataset created by the extension. The extension named your dataset using the Dataset ID that you specified during extension installation, `${DATASET_ID}`.

1.  From your raw changelog table, run the following query:  
  
    ```  
    SELECT COUNT(*) FROM  
      `${PROJECT_ID}.${COLLECTION_PATH}.${COLLECTION_PATH}_raw_changelog`  
      WHERE operation = "import"  
    ```

    The result set will contain the number of documents in your source collection.
