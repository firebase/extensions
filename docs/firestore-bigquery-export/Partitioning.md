# Partitioning

If you specified Table Partitioning parameters during configuration of the extension, you can include [table partitioning](https://cloud.google.com/bigquery/docs/partitioned-tables) on the BigQuery generated tables.

To improve performance BigQuery will divide table content based on the specific column data used in partitioning. Smaller and specific tables will mean faster querying and better results. Additionally, this will reduce costs as less data read will mean less cost-per-read for the owner of the project!

There are three types of partitioning offered by BigQuery

- Time-unit allows a user to partition on three different data types, specifically TIMESTAMP, DATE, and DATETIME.
- Ingestion Time based on the TIMESTAMP value of when the data was created
- Integer Range specifically partitions based on an integer value.

The BigQuery Firebase extension will automatically create the column and data type partitioning based on which configuration is used when installing the extension.

Partitioning affects both the `view` and `table` created by the extension in BigQuery.

## Creating a new partitioning field

An `existing` schema field can be used to define the field, however should a new field be needed - simply typing the new field name will automatically create a new field with the datatype of the selected `field_type`

If a field type has not been selected then the column will `not` be created and partitioning will instead use the default **`_PARTITIONTIME` field.**

## Querying Partitioned Tables

Developers can query data based on the specified partitioning field.

The following example shows an example query with a `created` field set as the partition column name along with a `DATTIME` partitioning type:

```sql
SELECT * FROM `example_dataset.table_raw_changelog`
WHERE created = "2022-04-18"
LIMIT 1000
```

## Reconfiguring

Unlike [Clustering](https://www.notion.so/Clustering-998244364c6a46b5951133af87fd17fd), an already partitioned table `cannot` be updated with new partition related configuration. The table must be deleted for the extension to create a new table with the updated specification.
