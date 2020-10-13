The `fs-bq-import-collection` script is for use with the official Firebase Extension [**Export Collections to BiqQuery**](https://github.com/firebase/extensions/tree/master/firestore-bigquery-export).

### Overview

The import script (`fs-bq-import-collection`) can read all existing documents in a Cloud Firestore collection and insert them into the raw changelog table created by the Export Collections to BigQuery extension. The import script adds a special changelog for each document with the operation of `IMPORT` and the timestamp of epoch. This ensures that any operation on an imported document supersedes the import record.

You may pause and resume the import script from the last batch at any point.

#### Important notes

- You must run the import script over the entire collection **_after_** installing the Export Collections to BigQuery extension; otherwise the writes to your database during the import might not be exported to the dataset.

- The import script can take up to _O(collection size)_ time to finish. If your collection is large, you might want to consider [loading data from a Cloud Firestore export into BigQuery](https://cloud.google.com/bigquery/docs/loading-data-cloud-firestore).

- You will see redundant rows in your raw changelog table if either of the following happen:

  - If document changes occur in the time between installing the extension and running the import script.
  - If you run the import script multiple times over the same collection.

### Run the script

The import script uses several values from your installation of the extension:

- `${PROJECT_ID}`: the project ID for the Firebase project in which you installed the extension
- `${COLLECTION_PATH}`: the collection path that you specified during extension installation
- `${BOOLEAN}`: Confirmation you would like to use a `collectionGroup` query. Reverts to a `collection` query if the value is `false`.
- `${DATASET_ID}`: the ID that you specified for your dataset during extension installation

Run the import script using [`npx` (the Node Package Runner)](https://www.npmjs.com/package/npx) via `npm` (the Node Package Manager).

1.  Make sure that you've installed the required tools to run the import script:

    - To access the `npm` command tools, you need to install [Node.js](https://www.nodejs.org/).
    - If you use `npm` v5.1 or earlier, you need to explicitly install `npx`. Run `npm install --global npx`.

1.  Set up credentials. The import script uses Application Default Credentials to communicate with BigQuery.

    One way to set up these credentials is to run the following command using the [gcloud CLI](https://cloud.google.com/sdk/gcloud/):

    ```shell
    gcloud auth application-default login
    ```

    Alternatively, you can [create and use a service account](https://cloud.google.com/docs/authentication/production#obtaining_and_providing_service_account_credentials_manually). This service account must be assigned a role that grants the `bigquery.datasets.create` [permission](https://cloud.google.com/bigquery/docs/access-control#bq-permissions).

1.  Run the import script via `npx` by running the following command:

    ```
    npx @firebaseextensions/fs-bq-import-collection
    ```

1.  When prompted, enter the Cloud Firestore collection path that you specified during extension installation, `${COLLECTION_PATH}`.

1.  _(Optional)_ You can pause and resume the import at any time:

    - **Pause the import:** enter `CTRL+C`  
      The import script records the name of the last successfully imported document in a cursor file called:
      `from-${COLLECTION_PATH}-to-${PROJECT_ID}:${DATASET_ID}:${rawChangeLogName}`,
      which lives in the directory from which you invoked the import script.

    - **Resume the import from where you left off:** re-run `npx @firebaseextensions/fs-bq-import-collection`
      _from the same directory that you previously invoked the script_

          Note that when an import completes successfully, the import script automatically cleans up the cursor file it was using to keep track of its progress.

1.  In the [BigQuery web UI](https://console.cloud.google.com/bigquery), navigate to the dataset created by the extension. The extension named your dataset using the Dataset ID that you specified during extension installation, `${DATASET_ID}`.

1.  From your raw changelog table, run the following query:

    ```
    SELECT COUNT(*) FROM
      `${PROJECT_ID}.${COLLECTION_PATH}.${COLLECTION_PATH}_raw_changelog`
      WHERE operation = "IMPORT"
    ```

    The result set will contain the number of documents in your source collection.
