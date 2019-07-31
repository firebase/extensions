### See it in action

To test out this mod, follow these steps:

1.  Go to the [Cloud Firestore tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data).

1.  If it doesn't exist already, create a collection called `${param:COLLECTION_PATH}`.

1.  Create a document with a field named `${param:URL_FIELD_NAME}` and make its value a URL such as `https://github.com/firebase/firebase-tools`.

1.  In a few seconds, you'll see a new field called `${param:SHORT_URL_FIELD_NAME}` pop up in the same document you just created; it will contain the shortened URL.

### Using the mod

This mod listens to the Cloud Firestore collection `${param:COLLECTION_PATH}`, then shortens any URL added to the field `${param:URL_FIELD_NAME}` in any document within that collection.

This mod shortens the URL then saves it in the `${param:SHORT_URL_FIELD_NAME}` field of the same document like so:

```
{
  ${param:URL_FIELD_NAME}: 'https://my.super.long-link.example.com/api/user/profile/-jEHitne10395-k3593085',
  ${param:SHORT_URL_FIELD_NAME}: 'https://bit.ly/EKDdza',
}
```

If the original URL in a document is updated, then the shortened URL will be automatically updated, too.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/mods/manage-installed-mods#monitor) of your installed mod, including checks on its health, usage, and logs.
