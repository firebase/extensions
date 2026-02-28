# Clustering

If you specified a "Clustering" parameter during configuration of the extension, you can include a [clustering](https://cloud.google.com/bigquery/docs/clustered-tables) order of fields in your BigQuery generated tables.

Clustering is a feature that organises table data by sorting specified columns and is an ideal solution for reducing the number of reads made on a table through a query.

When defining clustering, multiple columns can be defined allowing specific ordering of records to minimise the number of unnecessary reads on a query.

## Adding columns to cluster

Through the extension, adding clustering is as simple as adding a comma-separated list of the columns you would like to cluster by - this is then applied to the BigQuery table.

Clustering allows up to a maximum of four fields and can be configured similar to

`document_id, document_name, timestamp, event_id, data`

![example](/docs/firestore-bigquery-export/media/clustering.png)

## Ignoring Columns

Any columns that are added as part of the configuration, but do not exist on the table schema will be ignored.

## Pre-existing tables

If a pre-existing table exists, the extension will overwrite the previous configuration.
