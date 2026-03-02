# Firebase Extension: Stream Firestore to BigQuery

This guide explains how to use the `fs-bq-schema-views` script with the official Firebase Extension _Stream Firestore to BigQuery_, or the [import script](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/IMPORT_EXISTING_DOCUMENTS.md).

## What This Script Does

The `fs-bq-schema-views` script creates richly-typed BigQuery views from your raw Firestore changelog data. While the extension mirrors your raw data to BigQuery, this script helps you apply proper schemas and types to make your data more queryable.

### Key Benefits

- Applies data types to your raw Firestore data in BigQuery
- Uses BigQuery's JSON functions to create structured views
- Preserves all raw data (no data loss due to schema mismatches)
- Supports complex Firestore data types like arrays, maps, and geopoints

### AI-powered schema generation with Genkit

This extension uses the [Genkit SDK](https://genkit.dev/) to power AI-based schema generation for Firestore data.

For more information about Genkit, visit the Genkit documentation at [genkit.dev](http://genkit.dev/).

## Prerequisites

1. Node.js installed (to run npm and npx commands)

2. **Firebase Extension Installation**:

   - The ["Stream Firestore to BigQuery" Firebase Extension](https://extensions.dev/extensions/firebase/firestore-bigquery-export) must be installed and configured
   - Or you must have run the import script so the changelog table and latest view exist in BigQuery

3. BigQuery dataset set up (the one specified when configuring the Firebase Extension)

4. Firebase project with Firestore data (only required if using the AI schema generation feature)

5. Authentication configured:
   - Use gcloud CLI: `gcloud auth application-default login`
   - Or use a service account with `bigquery.jobs.create` permissions
   - Your service account needs the ["BigQuery Job User" role](https://cloud.google.com/iam/docs/understanding-roles#bigquery-roles) or equivalent

## Getting Started

### Option 1: Generate a Schema with Gemini AI (Recommended)

The easiest way to create a schema file is to let Gemini generate one for you based on your actual Firestore data.

#### Prerequisites

- [Google AI API key](https://aistudio.google.com)

#### Interactive Mode

```bash
npx @firebaseextensions/fs-bq-schema-views
```

You'll be prompted for:

- Firebase Project ID
- BigQuery Project ID
- BigQuery dataset ID
- Table Prefix
- Firestore collection path to sample
- Whether to use collection group query
- Google AI API key
- Directory and filename for the schema

#### Non-Interactive Mode

```bash
npx @firebaseextensions/fs-bq-schema-views \
  --non-interactive \
  --project=my-firebase-project \
  --big-query-project=my-bq-project \
  --dataset=firestore_changelog \
  --table-name-prefix=user_profiles \
  --use-gemini=users_collection \
  --google-ai-key=$GOOGLE_API_KEY \
  --schema-directory=./schemas \
  --gemini-schema-file-name=user_schema
```

For collection group queries (to query all collections with the same name across your database):

```bash
npx @firebaseextensions/fs-bq-schema-views \
  --non-interactive \
  --project=my-firebase-project \
  --big-query-project=my-bq-project \
  --dataset=firestore_changelog \
  --table-name-prefix=user_profiles \
  --use-gemini=secure \
  --query-collection-group \
  --google-ai-key=$GOOGLE_API_KEY \
  --schema-directory=./schemas \
  --gemini-schema-file-name=user_schema
```

#### Understanding Collection vs Collection Group Queries

- **Collection Query** (default): Queries documents from a specific collection path

  - Example: `users/123/orders` - queries orders for a specific user
  - Use when you have a specific collection path

- **Collection Group Query** (`--query-collection-group`): Queries all collections with the same name across your entire database
  - Example: `orders` - queries all order collections regardless of their parent path
  - Use when you have collections with the same name under different documents
  - Useful for subcollections that appear in multiple places

⚠️ **Important**: Always review generated schemas before using them in production.

### Option 2: Create a Schema File Manually

#### Create a Basic Schema

Create a file (e.g., `test_schema.json`) containing:

```json
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

#### Handle Reserved Keywords

SQL has reserved keywords that can cause conflicts. Use `column_name` to create a safe alias:

```json
{
  "fields": [
    {
      "name": "timestamp", // SQL reserved keyword
      "type": "timestamp",
      "column_name": "event_timestamp" // Safe alternative name
    }
  ]
}
```

### Verify Your Authentication

Make sure your authentication from the prerequisites is working correctly before proceeding. The script needs BigQuery access to create views.

### Run the Script

```bash
npx @firebaseextensions/fs-bq-schema-views \
  --non-interactive \
  --project=YOUR_PROJECT_ID \
  --big-query-project=YOUR_BIGQUERY_PROJECT_ID \
  --dataset=YOUR_DATASET_ID \
  --table-name-prefix=YOUR_TABLE_PREFIX \
  --schema-files=./test_schema.json
```

For collection group queries with manual schemas:

```bash
npx @firebaseextensions/fs-bq-schema-views \
  --non-interactive \
  --project=YOUR_PROJECT_ID \
  --big-query-project=YOUR_BIGQUERY_PROJECT_ID \
  --dataset=YOUR_DATASET_ID \
  --table-name-prefix=YOUR_TABLE_PREFIX \
  --schema-files=./test_schema.json \
  --query-collection-group
```

For multiple schema files, use comma separation:

```
--schema-files=./schema1.json,./schema2.json
```

## Testing Your Schema Views

1. In the [BigQuery web UI](https://console.cloud.google.com/bigquery), navigate to your dataset and find the new view: `YOUR_TABLE_PREFIX_schema_test_schema_changelog`

   You can access this view directly using the URL:
   `https://console.cloud.google.com/bigquery?project=YOUR_PROJECT_ID&p=YOUR_PROJECT_ID&d=YOUR_DATASET_ID&t=YOUR_TABLE_PREFIX_schema_test_schema_changelog&page=table`

2. Create a test document in Firestore with fields matching your schema:

   - Add a document named `test-schema-document`
   - Include fields like "name" (string) and "age" (number)

3. Run a query against your changelog view:

   ```sql
   SELECT document_name, name, age
   FROM YOUR_PROJECT_ID.YOUR_DATASET_ID.YOUR_TABLE_PREFIX_schema_test_schema_changelog
   WHERE document_name = "test-schema-document"
   ```

4. Test schema validation by changing a field type in Firestore (e.g., change "age" from number to string)

5. Run the query again to see how type mismatches appear (as NULL values)

6. _(Optional)_ You can also query events on the view of the documents currently in the collection by using the latest schema view at:
   `https://console.cloud.google.com/bigquery?project=YOUR_PROJECT_ID&p=YOUR_PROJECT_ID&d=YOUR_DATASET_ID&t=YOUR_TABLE_PREFIX_schema_test_schema_latest&page=table`

## Schema Configuration Details

### Available Field Types

- `string`
- `number`
- `boolean`
- `timestamp`
- `geopoint`
- `array`
- `map`
- `reference`
- `null`
- `stringified_map` (special type for converting maps to JSON strings)

### Example Schema with Various Types

```json
{
  "fields": [
    {
      "name": "name",
      "type": "string"
    },
    {
      "name": "favorite_numbers",
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
      "name": "geo_point",
      "type": "stringified_map"
    },
    {
      "name": "friends",
      "type": "map",
      "fields": [
        {
          "name": "name",
          "type": "string"
        }
      ]
    }
  ]
}
```

### Generated Views

For each schema file, the script creates two views:

1. **Changelog View**: `YOUR_TABLE_PREFIX_schema_SCHEMA_FILE_NAME_changelog`

   - Contains all document changes with typed columns
   - Includes all historical data

2. **Latest View**: `YOUR_TABLE_PREFIX_schema_SCHEMA_FILE_NAME_latest`
   - Contains only the current state of documents
   - Better for querying the present state of your data

### Column Data Types

| Firestore Type | BigQuery Type    | Notes                                                  |
| -------------- | ---------------- | ------------------------------------------------------ |
| string         | STRING           |                                                        |
| boolean        | BOOLEAN          |                                                        |
| number         | NUMERIC          |                                                        |
| timestamp      | TIMESTAMP        |                                                        |
| geopoint       | GEOGRAPHY        | In latest views, split into latitude/longitude columns |
| reference      | STRING           | Contains path to referenced document                   |
| null           | NULL             |                                                        |
| map            | Nested columns   | Columns created for each field in the map              |
| array          | Unnested columns | Creates \_member and \_index columns                   |

## Common Issues and Troubleshooting

### Schema Configuration Mistakes

| Issue                            | Result                | Solution                               |
| -------------------------------- | --------------------- | -------------------------------------- |
| Missing field in schema          | No column in the view | Add the field to your schema           |
| Wrong field type                 | NULL values           | Update schema with correct type        |
| Field doesn't exist in Firestore | NULL values           | Remove from schema or add to Firestore |
| Invalid JSON in schema file      | View generation fails | Validate your JSON syntax              |

### Working with Arrays

- Arrays are unnested in BigQuery views
- Each array element becomes a separate row
- Use `${ARRAY_NAME}_member` to access values
- Use `${ARRAY_NAME}_index` for position in array
- If the array is empty, it will be ignored by the `fs-bq-schema-views` script
- Review [these examples](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/EXAMPLE_QUERIES.md#example-queries-for-an-array) specifically for querying an array

## Next Steps

- [View example queries](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/EXAMPLE_QUERIES.md)
