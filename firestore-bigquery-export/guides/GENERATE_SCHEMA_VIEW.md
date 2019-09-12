This is a place holder.

Its content is developed in go/firestore-bigquery-export-docs

### Firestore BigQuery collection Mirroring Extension

Use this extension to mirror the contents of a Firestore collection in a BigQuery table. The extension creates a Firestore-triggered Cloud Function that runs each time a document is created, updated or deleted within the chosen Firestore collection to mirror.

## BigQuery Resources

This extension creates the following resources in BigQuery for the given project.

* `${tableName}_raw_changelog` (table) The raw changelog, created on the first recorded document change event ([more](#raw-changelog)).
* `${tableName}_schema_${schemaName}_changelog` (view) Contains all the rows in the raw changelog with the schema in `schemas/${schemaName}.json` applied.  Created by the schema view generator script ([more](#schema-view-generation)).
* `${tableName}_raw_latest` (view) Contains the latest events for all live documents in the raw changelog. Created on the first recorded document change event ([more](#latest-raw-changelog)).
* `${tableName}_schema_${schemaName}_latest` (view) Contains the latest events for all live documents in the raw changelog with the schema `schemas/${schemaName}.json` applied ([more](#schema-view-generation)).  Created by schema view generator script.

## Raw Changelog

This extension writes all document change events to a schemaless table called `{TABLE_NAME}_raw`. This table has the following columns:

* `timestamp TIMESTAMP REQUIRED` - The timestamp of the change as reported by Cloud Firestore, or the timestamp at which the Cloud Function was triggered in the case of a `DELETE`. If the `operation` is an `IMPORT`, this timestamp will be the beginning of the epoch (this is to ensure that any operation on an imported document supersedes the `IMPORT`).
* `event_id STRING REQUIRED` - The id of the event that triggered the Cloud Function which recorded the row.
* `document_name STRING REQUIRED` - The full name of the updated document: (e.g., projects/collection/databases/(default)/documents/users/me).
* `operation STRING REQUIRED` - One of `CREATE`, `UPDATE`, `IMPORT`, or `DELETE`.
* `data STRING NULLABLE` - The full JSON representation of the document state with the operation in the row applied. This field will be `null` for `DELETE` operations.

## Latest Raw Changelog

In addition to `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_raw`, this extension also creates a [BigQuery view](https://cloud.google.com/bigquery/docs/views) called `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_raw_latest` which reports latest events for all live documents in the Firestore collection. This view may be used to query the current state of the Firestore collection. By default, the raw changelog is unbounded. The latest view over the raw changelog can serve as a source for scheduled bulk transfers into a backup table. For more information on this use-case, see the documentation on [scheduled queries](https://cloud.google.com/bigquery/docs/scheduling-queries)

## Firestore Collection Imports

This extension also provides a resumable import script which may be used to backfill data from a Firestore collection into the raw changelog. We reserve the `IMPORT` operation type for document changes introduced in this manner.

All `IMPORT`s are assigned a timestamp of `1970-01-01 00:00:00 UTC`. This means that you may use this script to backfill data into a collection, without overriding it's contents from the perspective of the `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_raw_latest` view.  For more information on running this script, see the post-install [instructions](./POSTINSTALL.md).

## Schema View Generation

This extension includes a script that may be used to generate richly-typed BigQuery views over the raw changelog. These views are inexpensive to create and delete, but require you to specify a schema file up front.

### Schema Files

In order to generate schema views of your raw changelog, you must specify at least one schema json file in `./schemas`, where `.` is the directory from which you plan to run the view-generator script.

Here is an example of what a schema file might contain:

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

The root of the configuration must contain a `fields` array containing object which describe the elements in the schema. One element of the schema may have type `map`, in which case that element must also specify a `fields` array describing the members of the map.

Each field must have one of the following types:
* `string`
* `array`
* `map`
* `boolean`
* `number`
* `timestamp`
* `geopoint`
* `null`

You may specify any number of such schemas files in `./schemas/*.json`, and the view generation script will generate the following views for each of file:

1. `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_schema_${SCHEMA_FILE_NAME}_changelog`
2. `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_schema_${SCHEMA_FILE_NAME}_latest`

Here, ${SCHEMA_FILE_NAME} is the name of the file that lives in `./schemas`.

### The Schema Views

Each schema view carries with it the following fields from the raw changelog:

* `document_name STRING REQUIRED`
* `timestamp TIMESTAMP REQUIRED`
* `operation STRING REQUIRED`

The remaining columns correspond to fields of the schema and are assigned types based on the corresponding firestore types those fields have. With the exception of `maps` and `array`s, the conversion scheme is as follows:

| Firestore Type | BigQuery Type |
|:--------------:|:-------------:|
| string         | STRING        |
| boolean        | BOOLEAN       |
| number         | NUMERIC       |
| timestamp      | TIMESTAMP     |
| geopoint       | GEOGRAPHY\*   |
| null           | NULL          |

*Event timestamps will have millisecond resolution*

Firestore maps are interpreted recursively. If you include a map in your schema field, the resulting view will contain columns for whatever fields that map contains. If the map doesn't contain any field, it will be ignored by the schema-generator script.

Firestore arrays are [unnested](https://cloud.google.com/bigquery/docs/reference/standard-sql/query-syntax#unnest) and [cross joined](https://cloud.google.com/bigquery/docs/reference/standard-sql/query-syntax#cross-join) with the remaining columns. The extension retains the member and offset columns, which are called `${FIRESTORE_ARRAY_NAME}_member`, and `${FIRESTORE_ARRAY_NAME}_index` respectively. The extension includes these columns instead of the original `ARRAY` value field for querying ease.

The first view (1) is a table which contains all rows present in the raw changelog. This view is analogous to the raw change-log, only it has typed columns corresponding to fields of the schema.

The second view (2) stores typed rows for only the set of live documents in the collection.  This view is analogous to the latest view on the raw changelog, only it includes the typed columns corresponding to fields in the corresponding schema file.  Since `GEOGRAPHY` fields are not groupable entities in BigQuery (and the query which builds the latest view of a collection of documents requires grouping on the schema columns) the latest schema omits any `GEOGRAPHY` columns, and instead splits them out into two `NUMERIC` columns called `${FIRESTORE_GEOPOINT}_latitude` and `${FIRESTORE_GEOPOINT}_longitude`.

### Mistakes

The are several kinds of mistakes one might make in specify a schema.

* One could omit a relevant field. In this case, the generated view will simply not contain a column for that field.
* One could could specify the wrong type for a relevant field. In this case, type conversion (see previous section) will fail and the resulting column will contain BigQuery `null`s in lieu of the desired value.
* One could specify a schema field that doesn't exist in the underlying raw changelog. In this case querying the column for that field will return BigQuery `null`s instead of the desired value.

Since all document data is stored in the schemaless changelog, mistakes in schema specification can be resolved by simply removing the offending schema field from `./schemas`, adding a new corrected one, and re-running the schema generation script. BigQuery views are inexpensive to destroy and create, but querying a newly created view may take longer than querying a "warm" one.

### Examples

Assume we have a schema view matching the file above. We could generate a listing of users that have logged in to the application as follows:

```
SELECT name, last_login FROM `${param:PROJECT_ID}.${param:DATASET_ID}.${param:TABLE_NAME}_schema_${SCHEMA_FILE_NAME}_latest ORDER BY last_login DESC`
```

Here, the `last_login` column contains data that is stored in the `data` column of the raw changelog. The type conversion and view generation is performed for you by the extension.

In our schema, we store each users favorite in a Firestore array called `favorite_numbers`.  Suppose we wanted to determine how many favorite numbers each user currently has. We could run the following query:

```
SELECT document_name, MAX(favorite_numbers_index) FROM `wyszynski-extensions.users.users_schema_user_full_schema_latest` GROUP BY document_name
```

If we wanted to find out what our users' current favorite numbers are (assuming that number is stored in the first position of `favorite_numbers` array), we could run:

```
SELECT document_name, favorite_numbers_member FROM `wyszynski-extensions.users.users_schema_user_full_schema_latest` WHERE favorite_numbers_index = 0
```

If we had multiple arrays in our schema, we might have to select all `DISTINCT` documents to get rid of the redundant rows introduced by the `CROSS JOIN`s cartesian product.

```
SELECT DISTINCT document_name, favorite_numbers_member FROM `wyszynski-extensions.users.users_schema_user_full_schema_latest` WHERE favorite_numbers_index = 0
```

You may, at any time, add additional schema files to the `./schemas` and re-run the schema view generation script to create additional schema views over your raw changelog. Once you settle on a fixed schema, you may create a [scheduled query](https://cloud.google.com/bigquery/docs/scheduling-queries) to transfer the columns reported by schema view to a persistent backup table.

### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Firestore
- BigQuery
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
