## See it in action

### Raw Change Mirroring

1. Go to the [Cloud Firestore tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data).

2. If one doesn't exist already, create a collection called `${param:COLLECTION_PATH}`.

3. Create a document called `bigquery-mirror-test`.

4. [Open](https://pantheon.corp.google.com/bigquery?project=${param:PROJECT_ID}&p=${param:PROJECT_ID}&d=${param:DATASET_ID}&t=${param:COLLECTION_PATH}_raw_changelog&page=table) up the raw changelog in BigQuery.

5. Run ```SELECT * FROM `${param:PROJECT_ID}.${param:DATASET_ID}.${param:COLLECTION_PATH}_raw_changelog` ```, you should observe a single row with the contents of the `bigquery-mirror-test` document.

6. Navigate to [latest view of the change log](https://pantheon.corp.google.com/bigquery?project=${param:PROJECT_ID}&p=${param:PROJECT_ID}&d=${param:DATASET_ID}&t=${param:COLLECTION_PATH}_raw_latest&page=table) and run ```SELECT * FROM `${param:PROJECT_ID}.${param:DATASET_ID}.${param:COLLECTION_PATH}_raw_latest` ```.

6. Delete the `bigquery-mirror-test` document from [Cloud Firestore](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data).

7. The `bigquery-mirror-test` document will disappear from the latest view and you will see a `DELETE` event get added to ```${param:COLLECTION_PATH}_raw_changelog```.

### Collection Imports

**Please be aware that this process requires a Firestore read for every Document in your Collection.**

1. Go to the [Cloud Firestore tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data) and create a collection called `${param:COLLECTION_PATH}_import_from`.

2. Populate this collection with some data.

3. Navigate to the root of the `export-firestore-bigquery` source in the extensions repository.

4. Run ```npm run-script compile && npm run-script import``` and follow the prompts. When asked

```
? What is the name of the Cloud Firestore Collection you are mirroring? (Documents in the source Collection will be written to the raw changelog for this Collection.)
```

respond with ```${param:COLLECTION_PATH}```.

5. If you want to pause the import, you may interrupt the import process with ```CTRL+C``` and re-run ```npm run-script import``` to resume the import from where you left off in the last run.

6. Navigate to the [target table](https://pantheon.corp.google.com/bigquery?project=${param:PROJECT_ID}&p=${param:PROJECT_ID}&d=${param:DATASET_ID}&t=${param:COLLECTION_PATH}_raw_changelog&page=table) in BigQuery and run ```SELECT COUNT(*) FROM `${param:PROJECT_ID}.${param:COLLECTION_PATH}.${param:COLLECTION_PATH}_raw_changelog` WHERE operation = "IMPORT"```. The result set will contain the number of documents in your source Collection.

**If you try to import the same collection multiple times, you will end up with redundant rows in your raw changelog.**

### Schema Views

1. Navigate to the root of the `export-firestore-bigquery` source in the extensions repository.

2. Write the following schema to `./functions/schemas/test_schema.json`:

```
{
  "fields": [
    {
      "name": "name",
      "type": "string"
    },
    {
      "name": "age",
      "type": "number"
    }
  ]
}
```

3. Run ```npm run-script compile && npm run-script gen-schema-view```. When asked

```
? What is the name of the Cloud Firestore Collection that you would like to generate a schema view for?
```

respond with ```${param:COLLECTION_PATH}```.

4. Navigate to the generated [schema changelog](https://pantheon.corp.google.com/bigquery?project=${param:PROJECT_ID}&p=${param:PROJECT_ID}&d=${param:DATASET_ID}&t=${param:COLLECTION_PATH}_schema_test_schema_changelog&page=table) in BigQuery. This view allows you to query document change events by fields specified in the schema.

5. Go back to the [Cloud Firestore tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data), and create a document called `test-schema-document` with a string field called "name", and a number field called "age".

6. Back in the [schema changelog](https://pantheon.corp.google.com/bigquery?project=${param:PROJECT_ID}&p=${param:PROJECT_ID}&d=${param:DATASET_ID}&t=${param:COLLECTION_PATH}_schema_test_schema_changelog&page=table) view, run the following query: ```SELECT document_name, name, age FROM `${param:PROJECT_ID}.${param:DATASET_ID}.${param:COLLECTION_PATH}_schema_test_schema_changelog WHERE document_name = "test-schema-document"````.

7. Now, in the [Cloud Firestore tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data), change the type of the "age" field to be a string and re-run the query from step 6. You'll see a new change with a `null` age column. **When you query documents that don't match the schema, the view will contain null values for the corresponding schema fields**.

8. Delete the `test-schema-document` using the [Cloud Firestore tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data).

9. As with the raw views, you may also query events on the set of live documents view using the [latest schema view](https://pantheon.corp.google.com/bigquery?project=${param:PROJECT_ID}&p=${param:PROJECT_ID}&d=${param:DATASET_ID}&t=${param:COLLECTION_PATH}_schema_test_schema_latest&page=table). If you run ```SELECT document_name, name, age FROM `${param:PROJECT_ID}.${param:DATASET_ID}.${param:COLLECTION_PATH}_schema_test_schema_latest` WHERE document_name = "test-schema-document" ```, you'll receive no results because the document no longer exists in the Cloud Firestore Collection.

## Other Queries

There are a couple of queries you might be interested in running over the raw change log itself. For example, to generate a revision history for a single document:

```
SELECT * FROM `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_raw_changelog` WHERE document_name = "${DOCUMENT_NAME}" ORDER BY TIMESTAMP ASC LIMIT 1000
```

To extract the most up-to-date contents of a document:

```
SELECT data FROM `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_raw_changelog` WHERE document_name = "${DOCUMENT_NAME}" ORDER BY TIMESTAMP DESC LIMIT 1
```

**If DOCUMENT_NAME is deleted, this query will yield a single row with a null data column**.

In addition to `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_raw_changelog`, this extension also created a BigQuery [view](https://cloud.google.com/bigquery/docs/views) called `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_raw_latest` which reports latest events for all live documents in the Firestore collection. This view may be used to query the current state of the Firestore Collection. For example, to generate a listing of all live documents, you could run:

```
SELECT document_name FROM `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_raw_latest` LIMIT 1000
```

To extract the latest data in a document from this view, simply run:

```
SELECT data FROM `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_raw_latest` WHERE document_name = "${DOCUMENT_NAME}"
```
