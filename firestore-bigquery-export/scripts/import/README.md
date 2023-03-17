The `fs-bq-import-collection` script is for use with the official Firebase Extension [_Stream Firestore to BigQuery_](https://github.com/firebase/extensions/tree/master/firestore-bigquery-export).

This script reads all existing documents in a specified Firestore Collection, and updates the changelog table used by the `firestore-bigquery-export` extension.

A guide on how to use the script can be found [here](https://github.com/firebase/extensions/blob/master/firestore-bigquery-export/guides/IMPORT_EXISTING_DOCUMENTS.md).