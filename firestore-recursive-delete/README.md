# Recursively Delete Firestore Data

## Summary

Normally, deleting a Firestore document does not delete all of its subcollections. This leads to "orphaned" documents that still exist and are directly retrievable using their exact paths but do not show up in query results. This mod provides the ability for deleting all of the subcollections and documents of a path.

## Details

This mod creates an HTTPS callable function that the client code can call to recursively delete Firestore data. A path needs to be provided to the call. If the path represents a collection, then all of its documents and their subcollections will be deleted. If the path represents a document, then that document and all of its subcollections will be deleted. See `USAGE.md` for details.

### Configuration

This Mod has 1 optional environment variable for configuration:

- `LOCATION`: location to deploy the mod. For optimal performance, the mod consumer should pick a location closest to their Firestore database location. See `mod.yaml` for more info.

### Required Roles

Since this Mod needs to be able to delete data from Firestore, it requires the `datastore.user` role. (Firestore uses Datastore IAM roles.)

### Resources Created

This Mod creates one resource: an HTTPS Callable Cloud Function that the mod consumer's client code can call with a path parameter to recursively delete data at that path. You can learn more about HTTPS Callable functions at https://firebase.google.com/docs/functions/callable.

### Privacy

This mod stores the environment variables in the source of the Cloud Function.

### Potential Costs

_Disclaimer: without knowing your exact use, it's impossible to say exactly what this may cost._

This mod may generate costs due to:

- **Cloud Functions Usage**: When the client code calls the Cloud Function, an invocation will occur. If the free quota for Cloud Functions is consumed, then it will generate cost for the Firebase Project.
- **Firestore Usage**: Each invocation of the Cloud Function potentially results in document deletions. If the free quota for Firestore document deletion is consumed, then it will generate cost for the Firebase Project.

See more details at https://firebase.google.com/pricing.

### Copyright

Copyright 2018 Google LLC

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
