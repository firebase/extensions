The Mod will automatically shorten the URL in the `${param:URL_FIELD_NAME}` field in Documents created in the Cloud Firestore Collection: `${param:COLLECTION_PATH}`.

The Mod will shorten this URL and output it in the `${param:SHORT_URL_FIELD_NAME}` field of the Document like so:

```
{
  ${param:URL_FIELD_NAME}: 'https://my.super.long-link.com/api/user/profile/-jEHitne10395-k3593085',
  ${param:SHORT_URL_FIELD_NAME}: 'https://bit.ly/EKDdza',
}
```

If the URL in a Document is updated, the short URL will be automatically updated too.
