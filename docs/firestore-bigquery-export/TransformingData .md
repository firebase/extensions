# Transforming Data

If you specified a `transform function url` parameter during configuration of the extension, you can include a custom url to intercept and modify the `payload` before it is returned and saved into the BigQuery table.

## Payload Format

When data from Firestore has been created or modified, the entire payload is copied to the BigQuery table under the data column in the following format.

```json
{
  data: [{
    insertId: int;
    json: {
      timestamp: int;
      event_id: int;
      document_name: string;
      document_id: int;
      operation: ChangeType;
      data: string;
    },
  }]
}
```

## Syncing modified Data

By providing a custom URL, users can receive the original payload and modify it as required. The returned data from the response is then saved into the BigQuery table.
