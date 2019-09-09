### See it in action

To test out this extension, follow these steps:

1.  Go to the [Cloud Firestore tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data).

1.  If it doesn't exist already, create a collection called `${param:COLLECTION_PATH}`.

1.  Create a document with id of `history-test`.

1.  If you refresh the page in a few seconds, you'll see a new document called `${param:COLLECTION_PATH}/history-test/${param:SUB_COLLECTION_ID}/timestampInMicros`.

1.  Update or delete document `history-test` and see related history records inserted.

### Using the extension

Whenever a document with id of `id-xxx` is written with collection `${param:COLLECTION_PATH}` , this extension inserts a history document in its subcollection `${param:COLLECTION_PATH}/id-xxx/${param:SUB_COLLECTION_ID}/timestampInMicros` with the following format:

```
{
  // The content of the new document
  // Special change diff.
  __diff: {
    operation: "create", // one of create, update and delete.
    deleted: {...},  // The properties deleted.
    added: {...},  // The properties added.
  },
}
```

### Caveats
- Arrays are treated as opaque values in `__diff`. For example, in a field is changed from `[1, 2]` to `[2, 3]`.`deleted` contains the full original array `[1, 2]` and `added` contains the full new array `[2, 3]`. The diffing algorithm is defined in [`diff.ts`](https://github.com/FirebasePrivate/extensions/blob/master/firestore-document-histories/functions/src/diff.ts). Feel free to define your own diffing algorithm.
- Firestore document has a size limit of 1M. So if a document of size 0.6M is created, the original document and `__diff` will be 1.2M exceeding the limit. The histories of these docs will be missing.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.

This function will retry `DeadlineExceeded` and `Aborted` to make sure temporary errors do not lead to missing histories.

### How much does it costs?

Every time a document is inserted, updated or deleted within the target collection, function will be triggered once and one Firestore document will be created.

