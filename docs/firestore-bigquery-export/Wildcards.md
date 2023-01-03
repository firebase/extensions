# Wildcards

The data is stored as a If you specified a "wildcard" parameter during configuration of the extension, the wildcard values are added as a `JSON string` as an additional column in your exported dataset.

A [wildcard](https://firebase.google.com/docs/functions/firestore-events#wildcards-parameters) column contains the wildcard values extracted from a Firestore collection/sub-collection path.

## Parameters column

A new `string` column called `path_params` will be generated along side the default schemas.

All generated tables and views are updated with this new column:

![example](/docs/firestore-bigquery-export/media/wildcards.png)

An example path value could be `regions/{regionId}/countries` resulting in an object similar to

```js
{
  regionId: "Central America";
}
```

## Querying the data

As the data is defined as a `JSON string` a JSON_VALUE extractor will allow the value to be used as part of the query, for example:

```sql
SELECT document_id FROM `dataset.countries_raw_changelog` c
WHERE JSON_VALUE(c.path_params, "$.regionId") = "South America"
```
