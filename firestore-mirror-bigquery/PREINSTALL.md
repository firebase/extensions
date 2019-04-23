This mod allows you to mirror the contents of a Firestore collection to BigQuery.

The mod creates a Firestore-triggered cloud function that runs each time a Document is created, updated or deleted within the Firestore Collection that you have chosen to mirror.

The mod relies on a `schema.json` file to describe the contents of your Firestore collection, and creates the following within BigQuery:

1. A `{TABLE_NAME}_raw` table storing every change to documents within your Firestore collection. This table includes a number of metadata fields to allow the current state of your data to be displayed within BigQuery.

2. A `{TABLE_NAME}` view which represents the current state of the data within your Firestore collection.

**You need to update the `schema.json` file in the `functions` directory before installing the mod.**

## The Schema file

The `schema.json` file is used to describe the structure of Documents within your Firestore Collection. This file allows you to specify which fields should be mirrored, as well as telling BigQuery what type of data to expect for each field. It consists of the following:

- `fields`: An array of `Field` objects (see below)
- `idField`: An optional field to use as the ID for the Document. By default, the Firestore Document ID is used.
- `timestampField`: An optional field to use as the timestamp for the update. By default, the Function Event timestamp is used.

The `Field` object consists of the following:

- `fields`: An optional array of `Field` objects indicating the sub fields; only for `map` fields
- `name`: The name of the field
- `repeated`: An optional `boolean` to indicate this is an `array` field
- `type`: The type of the field; one of: `boolean`, `geopoint`, `number`, `map`, `reference`, `string`, `timestamp`

**It is recommended that you specify a `timestampField` in your schema as Cloud Functions for Firebase does not guarantee the ordering of event triggers.**

### Sample `schema.json`

```
{
  "fields": [
    {
      "name": "stringField",
      "type": "string",
    }, {
      "name": "numberArrayField",
      "type": "number",
      "repeated": true,
    }, {
      "name": "mapField",
      "type": "map",
      "fields": [{
          "name": "subBooleanField",
          "type": "boolean"
      }]
    }, {
      "name": "lastUpdated",
      "type": "timestamp",
    }
  ],
  "timestampField": "lastUpdated"
}
```
