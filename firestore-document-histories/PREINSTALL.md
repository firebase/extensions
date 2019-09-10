Use this mod to track the histories of all documents with a Firestore collection.

The extension creates a Firestore-triggered cloud function that runs each time a document is created, updated or deleted within the Firestore Collection of your choice.

For each document (`${config.COLLECTION_PATH}/${docId}`) has a corresponding history sub collection at

```
  ${config.COLLECTION_PATH}/${docId}/${config.SUB_COLLECTION_ID}/${commitTimeSinceEpoch}
```

Each history record contains the latest snasphot of the document, empty for a deleted document, and a change diff at `__diff`.

** Note Array are treated as opague values. **

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

You can easily query `__diff` to find writes that modified particular properties.

