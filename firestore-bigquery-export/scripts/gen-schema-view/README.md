The `fs-bq-schema-views` script is for use with the official Firebase Extension
[_Export Collections to BigQuery_](https://github.com/firebase/extensions/tree/master/firestore-bigquery-export).

This script creates a BigQuery view based on a provided JSON schema configuration file. It queries the data from the `firestore-bigquery-export` extension changelog table to generate the view.

A guide on how to use the script can be found [here](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/GENERATE_SCHEMA_VIEWS.md).