The `fs-bq-import-collection` script is for use with the official Firebase Extension [**Stream Firestore to BigQuery**](https://github.com/firebase/extensions/tree/master/firestore-bigquery-export).

### Overview

The import script (`fs-bq-import-collection`) can read all existing documents in a Cloud Firestore collection and insert them into the raw changelog table created by the Stream Firestore to BigQuery extension. The import script adds a special changelog for each document with the operation of `IMPORT` and the timestamp of epoch. This ensures that any operation on an imported document supersedes the import record.

You may pause and resume the import script from the last batch at any point.

#### Important notes

- You must run the import script over the entire collection **_after_** installing the Stream Firestore to BigQuery extension; otherwise the writes to your database during the import might not be exported to the dataset.

- The import script can take up to _O(collection size)_ time to finish. If your collection is large, you might want to consider [loading data from a Cloud Firestore export into BigQuery](https://cloud.google.com/bigquery/docs/loading-data-cloud-firestore).

- You will see redundant rows in your raw changelog table if either of the following happen:

  - If document changes occur in the time between installing the extension and running the import script.
  - If you run the import script multiple times over the same collection.

- You can use wildcard notation in the collection path. Suppose, for example, you have collections `users/user1/pets` and `users/user2/pets`, but also `admins/admin1/pets`. If you set `${COLLECTION_GROUP_QUERY}` to `true` and provide the collection path as `${users/{uid}/pets}`, the import script will import the former two collections but not the later, and will populate the `path_params` column of the big query table with the relevant `uid`s.

- You can also use a [collectionGroup](https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query) query. To use a `collectionGroup` query, provide the collection name value as `${COLLECTION_PATH}`, and set `${COLLECTION_GROUP_QUERY}` to `true`. For example, if you are trying to import `/collection/{document}/sub_collection`, the value for the `${COLLECTION_PATH}` should be provided as `sub_collection`. Keep in mind that if you have another sub collection with the same name (e.g. `/collection2/{document}/sub_collection`, that will be imported too.

- Warning: The import operation is not idempotent; running it twice, or running it after documents have been imported will likely produce duplicate data in your bigquery table.

You can also use a simple [collectionGroup](https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query) query. To use a `collectionGroup` query, provide the collection name value as `${COLLECTION_PATH}`, and set `${COLLECTION_GROUP_QUERY}` to `true`.

Warning: A `collectionGroup` query will target every collection in your Firestore project with the provided `${COLLECTION_PATH}`. For example, if you have 10,000 documents with a sub-collection named: `landmarks`, the import script will query every document in 10,000 `landmarks` collections.

### Run the script

The import script requires several values from your installation of the extension:

- `${PROJECT_ID}`: the project ID for the Firebase project in which you installed the extension
- `${BIGQUERY_PROJECT_ID}`: the project ID for the GCP project in which the BigQuery instance is located. Defaults to Firebase project ID.
- `${COLLECTION_PATH}`: the collection path that you specified during extension installation
- `${COLLECTION_GROUP_QUERY}`: uses a `collectionGroup` query if this value is `"true"`. For any other value, a `collection` query is used.
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

1.  Run the import script interactively via `npx` by running the following command:

    ```
    npx @firebaseextensions/fs-bq-import-collection
    ```

    **Note**: The script can be run non-interactively. To see its usage, run the above command with `--help`.

1.  _(Optional)_ When prompted, you can enter the BigQuery project ID to use a BigQuery instance located in a GCP project other than your Firebase project.

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

### Handling Failed Batches (`-f, --failed-batch-output`)

#### Overview

If any document batches fail to import due to errors, you can use the `-f` or `--failed-batch-output` option to specify a file where failed document paths will be recorded. This allows you to review and retry failed imports later.

---

#### Usage

```sh
npx @firebaseextensions/fs-bq-import-collection -f failed_batches.txt
```

In the example above, any documents that fail to import will have their paths written to `failed_batches.txt`.

---

#### Example Output

If some documents fail, the output file will contain paths like:

```
projects/my-project/databases/(default)/documents/users/user123
projects/my-project/databases/(default)/documents/orders/order456
projects/my-project/databases/(default)/documents/posts/post789
```

Each line corresponds to a document that failed to import.

---

#### Console Logging of Failed Batches

The import script will also log failed imports to the console. You may see output like this:

```
Failed batch: <paths of failed documents in batch>
```

This helps you quickly identify problematic documents and take action accordingly.

---

#### Retrying Failed Imports

To retry the failed imports, you can use the output file to manually inspect or reprocess the documents. For example, you could create a script that reads the failed paths and reattempts the import.

> **Note:** If the specified file already exists, it will be **cleared** before writing new failed batch paths.

### Using a Transform Function

You can optionally provide a transform function URL (`--transform-function-url` or `-f`) that will transform document data before it's written to BigQuery. The transform function should should recieve document data and return transformed data. The payload will contain the following:

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

The response should be identical in structure.

Example usage of the script with transform function option:

```shell
npx @firebaseextensions/fs-bq-import-collection --non-interactive \
 -P <PROJECT_ID> \
 -s <COLLECTION_PATH> \
 -d <DATASET_ID> \
 -f https://us-west1-my-project.cloudfunctions.net/transformFunction
```
