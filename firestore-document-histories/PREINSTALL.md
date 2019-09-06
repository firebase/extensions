This mod allows you to track the change histories of Firestore document in a Firestore collection.

The mod creates a Firestore-triggered cloud function that runs each time a Document is created, updated or deleted within the Firestore Collection that you have chosen to mirror.

For each document in the specified collection will have a corresponding collection with its history.
Each change document will be inserted at:
  ${config.COLLECTION_PATH}/${docId}/${config.SUB_COLLECTION_ID}/${commitTimeSinceEpoch}

The document will contain the latest snasphot of the document. For deleted document, it would be empty.

A diff will also be inserted at `__diff`, so it is easy to query for changes on a particular path. Array are treated as opague values.

```
{
  __diff: {
    operation: "insert", // one of insert, update and delete.
    deleted: {...},  // The properties paths that are deleted.
    added: {...},  // The properties paths that are added.
  }
}
```

