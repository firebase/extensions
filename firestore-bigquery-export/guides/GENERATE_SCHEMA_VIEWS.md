The `fs-bq-schema-views` script is for use with the official Firebase Extension
[_Export Collections to BigQuery_](https://github.com/firebase/extensions/tree/master/firestore-bigquery-export).

## Overview

The `fs-bq-schema-views` script (referred to as the "schema-views script")
generates richly-typed BigQuery views of your raw changelog.

The _Export Collections to BigQuery_ extension only mirrors raw data, but it
doesn't apply schemas or types. This decoupling makes schema validation less
risky because no data can be lost due to schema mismatch or unknown fields.

The schema-views script creates a BigQuery view, based on a JSON schema
configuration file, using
[BigQuery's built-in JSON functions](https://cloud.google.com/bigquery/docs/reference/standard-sql/json_functions).
The _Export Collections to BigQuery_ extension also provides some BigQuery
[user-defined functions](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/scripts/gen-schema-view/src/udf.ts)
that are helpful in converting Firestore document properties to richly-typed
BigQuery cells.

## Use the script

The following steps are an example of how to use the schema-views script. In the
sections at the end of this file, you can review detailed information about
configuring a schema file and reviewing the resulting schema views.

### Step 1: Create a schema file

The schema-views script runs against "schema files" which specify your schema
configurations in a JSON format.

In any directory, create a schema file called `test_schema.json`
that contains the following:

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

Learn [How to configure schema files](#how-to-configure-schema-files)
later in this guide.

### Step 2: Set up credentials

The schema-views script uses Application Default Credentials to communicate with
BigQuery.

One way to set up these credentials is to run the following command using the
[gcloud](https://cloud.google.com/sdk/gcloud/) CLI:

```
$ gcloud auth application-default login
```

Alternatively, you can
[create and use a service account](https://cloud.google.com/docs/authentication/production#obtaining_and_providing_service_account_credentials_manually).
This service account must be assigned a role that grants the permission of
`bigquery.jobs.create`, like the ["BigQuery Job User" role](https://cloud.google.com/iam/docs/understanding-roles#bigquery-roles).

### Step 3: Run the script

The schema-views script uses the following parameter values from your
installation of the extension:

- `${param:PROJECT_ID}`: the project ID for the Firebase project in
  which you installed the extension
- `${param:DATASET_ID}`: the ID that you specified for your dataset during
  extension installation
- `${param:TABLE_ID}`: the common prefix of BigQuery views to generate

Run the schema-views script using
[`npx` (the Node Package Runner)](https://github.com/npm/npx#npx1----execute-npm-package-binaries)
via `npm` (the Node Package Manager).

1.  Make sure that you've installed the required tools to run the
    schema-views script:

    - To access the `npm` command tools, you need to install
      [Node.js](https://www.nodejs.org/).
    - If you use npm v5.1 or earlier, you need to explicitly install `npx`.
      Run `npm install --global npx`.

1.  Run the schema-views script via `npx` by running the following command:

    ```
    $ npx @firebaseextensions/fs-bq-schema-views \
      --non-interactive \
      --project=${param:PROJECT_ID} \
      --dataset=${param:DATASET_ID} \
      --table-name-prefix=${param:TABLE_ID} \
      --schema-files=./test_schema.json
    ```

    **Note:** You can run the schema-views script from any directory, but
    you need to specify the path to your schema file using the `--schema-files`
    flag. To run the schema-views script against multiple schema files, specify
    each file in a comma-separated list
    (for example: `--schema-files=./test_schema.json,./test_schema2.json`).

### Step 4: View results

1.  In the [BigQuery web UI](https://console.cloud.google.com/bigquery),
    navigate to the generated schema changelog view:
    `https://console.cloud.google.com/bigquery?project=${param:PROJECT_ID}&p=${param:PROJECT_ID}&d=${param:DATASET_ID}&t=${param:TABLE_ID}_schema_test_schema_changelog&page=table`.

        This view allows you to query document change events by fields specified in
        the schema.

1.  In the [Firebase console](https://console.firebase.google.com/),
    go to the Cloud Firestore section,
    then create a document called `test-schema-document` with two fields:

    - A field of type `string` called "name"
    - A field of type `number` called "age"

1.  Back in BigQuery, run the following query in the schema changelog
    view (that is, `https://console.cloud.google.com/bigquery?project=${param:PROJECT_ID}&p=${param:PROJECT_ID}&d=${param:DATASET_ID}&t=${param:TABLE_ID}_schema_test_schema_changelog&page=table`):

    ```
    SELECT document_name, name, age
    FROM ${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_ID}_schema_test_schema_changelog
    WHERE document_name = "test-schema-document"
    ```

1.  Go back to the Cloud Firestore section of the console, then change
    the type of the "age" field to be a string.

1.  Back in BigQuery, re-run the following query:

    ```
    SELECT document_name, name, age
    FROM ${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_ID}_schema_test_schema_changelog
    WHERE document_name = "test-schema-document"
    ```

    You'll see a new change with a `null` age column. If you query documents
    that don't match the schema, then the view contains null values for the
    corresponding schema fields.

1.  Back in the Cloud Firestore section in the console, delete
    `test-schema-document`.

1.  _(Optional)_ As with the raw views, you can also query events on the
    view of the documents currently in the collection by using the latest
    schema view
    (that is, `https://console.cloud.google.com/bigquery?project=${param:PROJECT_ID}&p=${param:PROJECT_ID}&d=${param:DATASET_ID}&t=${param:COLLECTION_PATH}_schema_test_schema_latest&page=table`.

    Back in BigQuery, if you run the following query, you'll receive no
    results because the document no longer exists in the Cloud Firestore
    collection.

    ```
    SELECT document_name, name, age
    FROM ${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_ID}_schema_test_schema_latest
    WHERE document_name = "test-schema-document"
    ```

### Next Steps

- [Create your own schema files](#how-to-configure-schema-files)
- [Troubleshoot common issues](#common-schema-file-configuration-mistakes)
- [Learn about the columns in a schema view](#columns-in-a-schema-view)
- [Take a look at more SQL examples](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/EXAMPLE_QUERIES.md)

## How to configure schema files

To generate schema views of your raw changelog, you must create at least one
schema JSON file.

Here's an example of a configuration that a schema file might contain:

```
{
  "fields": [
    {
      "name": "name",
      "type": "string"
    },
    {
      "name":"favorite_numbers",
      "type": "array"
    },
    {
      "name": "last_login",
      "type": "timestamp"
    },
    {
      "name": "last_location",
      "type": "geopoint"
    },
    {
      "fields": [
        {
          "name": "name",
          "type": "string"
        }
      ],
      "name": "friends",
      "type": "map"
    }
  ]
}
```

The root of the configuration must have a `fields` array that contains objects
which describe the elements in the schema. If one of the objects is of type
`map`, it must specify its own `fields` array describing the members of that
map.

Each `fields` array must contain _at least one_ of the following types:

- `string`
- `array`
- `map`
- `boolean`
- `number`
- `timestamp`
- `geopoint`
- `reference`
- `null`

These types correspond with Cloud Firestore's
[supported data types](https://firebase.google.com/docs/firestore/manage-data/data-types).
Make sure that the types that you specify match the types of the fields in your
Cloud Firestore collection.

You may create any number of schema files to use with the schema-views script.
The schema-views script generates the following views for _each_ schema file:

- `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_ID}_schema_${SCHEMA_FILE_NAME}_changelog`
- `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_ID}_schema_${SCHEMA_FILE_NAME}_latest`

Here, `${SCHEMA_FILE_NAME}` is the name of each schema file that you provided as
an argument to run the schema-views script.

### Common schema file configuration mistakes

Be aware of the following common mistakes when configuring a schema file:

<table>
  <thead>
    <tr>
      <th><strong>Mistake in schema file config</strong></th>
      <th><strong>Outcome of mistake</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Omitting a relevant field</td>
      <td>The generated view will not contain a column for that field.</td>
    </tr>
    <tr>
      <td>Specifying the wrong type for a relevant field</td>
      <td>Type conversion (see previous section) will fail and the resulting column
        will contain a BigQuery <code>null</code> value in lieu of the desired
        value.</td>
    </tr>
    <tr>
      <td>Specifying a schema field that doesn't exist in the underlying raw
        changelog</td>
      <td>Querying the column for that field will return a BigQuery <code>null</code>
        value instead of the desired value.</td>
    </tr>
    <tr>
      <td>Writing invalid JSON</td>
      <td>The schema-views script cannot generate a view</td>
    </tr>
  </tbody>
</table>

Since all document data is stored in the schemaless changelog, mistakes in
schema configuration don't affect the underlying data and can be resolved by
re-running the schema-views script against an updated schema file.

## About Schema Views

### Views created by the script

- `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_ID}_schema_${SCHEMA_FILE_NAME}_changelog`

  This view is a table which contains all rows present in the raw changelog.
  This view is analogous to the raw change-log, only it has typed columns
  corresponding to fields of the schema.

- `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_ID}_schema_${SCHEMA_FILE_NAME}_latest`

  This view stores typed rows for the documents currently in the collection.
  This view is analogous to the "latest" view on the raw changelog, only it
  includes the typed columns corresponding to fields in the corresponding
  schema file.

  Since `GEOGRAPHY` fields are not groupable entities in BigQuery (and the
  query which builds the latest view of a collection of documents requires
  grouping on the schema columns), the latest schema omits any `GEOGRAPHY`
  columns and, instead, splits them out into two `NUMERIC` columns called
  `${FIRESTORE_GEOPOINT}_latitude` and `${FIRESTORE_GEOPOINT}_longitude`.

### Columns in a schema view

Each schema view carries with it the following fields from the raw changelog:

- `document_name STRING REQUIRED`
- `timestamp TIMESTAMP REQUIRED`
- `operation STRING REQUIRED`

The remaining columns correspond to fields of the schema and are assigned types
based on the corresponding Cloud Firestore types those fields have. With the
exception of `map` and `array`, the type conversion scheme is as follows:

<table>
  <thead>
    <tr>
      <th><strong>Cloud Firestore type</strong></th>
      <th><strong>BigQuery type</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>string</td>
      <td>STRING</td>
    </tr>
    <tr>
      <td>boolean</td>
      <td>BOOLEAN</td>
    </tr>
    <tr>
      <td>number</td>
      <td>NUMERIC</td>
    </tr>
    <tr>
      <td>timestamp</td>
      <td>TIMESTAMP</td>
    </tr>
    <tr>
      <td>geopoint</td>
      <td>GEOGRAPHY</td>
    </tr>
    <tr>
      <td>reference</td>
      <td>STRING<br>(containing the path to the referenced document)</td>
    </tr>
    <tr>
      <td>null</td>
      <td>NULL</td>
    </tr>
  </tbody>
</table>

#### Cloud Firestore maps

Cloud Firestore maps are interpreted recursively. If you include a map in your
schema configuration, the resulting view will contain columns for whatever
fields that map contains. If the map doesn't contain any fields, the map is
ignored by the schema-views script.

#### Cloud Firestore arrays

Review [these examples](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/EXAMPLE_QUERIES.md#example-queries-for-an-array) for querying an array.

Cloud Firestore arrays are
[unnested](https://cloud.google.com/bigquery/docs/reference/standard-sql/query-syntax#unnest),
so all array fields of the document are
[cross joined](https://cloud.google.com/bigquery/docs/reference/standard-sql/query-syntax#cross-join)
in the output table. The view retains the member and offset columns, which are
called `${FIRESTORE_ARRAY_NAME}_member` and `${FIRESTORE_ARRAY_NAME}_index`,
respectively. To make querying easier, the view includes these two columns
instead of the original `ARRAY` value field.

If the array is empty, it will be ignored by the schema-views script.
