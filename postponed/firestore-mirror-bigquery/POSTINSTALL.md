You are now set up to mirror your Firestore Collection to BigQuery!

Every time that a document is added to the collection `${param:COLLECTION_PATH}`, it will be validated against the supplied `schema.json`, and matching fields will be added to the BigQuery table: `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}`.

You can query the state of your Collection within BigQuery by running the following:

```
SELECT * FROM `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}`
```

## Import existing data

**Please be aware that this process requires a read for every Document in your Collection.**

If you already have Documents in you Firestore Collection, then you can run the supplied import script to populate BigQuery with this data:

1. Ensure that your `schema.json` file is setup correctly.
2. From the `functions` directory, run `npm run import`.
3. You will be prompted to enter your Firebase Project ID, the Cloud Firestore collection that you would like to mirror, and information about the BigQuery dataset you would like to mirror the data to.
4. The import script will iterate through the Collection and add each Document to BigQuery.
