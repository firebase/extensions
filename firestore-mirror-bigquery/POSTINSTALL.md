You are now set up to mirror your Firestore Collection to BigQuery!

Every time that a document is added to the collection `${param:COLLECTION_PATH}`, it will be validated against the supplied `schema.json`, and matching fields will be added to the BigQuery table: `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}`.

You can query the state of your Collection within BigQuery by running the following:

```
SELECT * FROM `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}`
```
