You are now set up to track the changes of a collection.

Every time that a document in the collection `${param:COLLECTION_PATH}` is changed.
A change history will be added to ${param:COLLECTION_PATH}/${docId}/${param:SUB_COLLECTION_ID}/${commitTimeSinceEpoch}

By default, this function will only retry `DeadlineExceeded` and `Aborted` to make sure temporary errors do not affect correctness.

