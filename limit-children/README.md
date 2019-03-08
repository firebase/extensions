# Limit number of child nodes

## Summary

Limit the number of child nodes in a Firebase Realtime database below a given number.
This can be used to limit the number of lines of a chat history or logs.

## Details

This Mod defines a Cloud Function that will trigger on write of a document to the Firebase Realtime Database. If the number of messages in the database at `PARENT_NODE_PATH` exceeds `MAX_COUNT`, this mod will prune the messages down to `MAX_COUNT`, deleting the oldest messages first.

### Configuration

This Mod requires the following environment variables to be set:

- `MAX_COUNT` an integer representing the upper limit of items the mod should keep
- `PARENT_NODE_PATH` a string representing the path we want the mod to operate on.

### Required Roles

This Mod requires the following IAM roles:

- `firebase.developAdmin` allows access to the Firebase "develop" products. This mod uses this role to delete messages in the database.

### Resources Created

- a Cloud Function that triggers on write of a message in the database.

### Privacy

This mod stores the environment variables in the source of the Cloud Function.

### Potential Costs

_Disclaimer: without knowing your exact use, it's impossible to say exactly what this may cost._

This mod will generate costs due to:

- **Cloud Functions Usage**: Each time a message is written to the path specified, a Cloud Function is invoked. If the free quota for Cloud Functions is consumed, then it will generate cost for the Firebase project.
  .

See more details at https://firebase.google.com/pricing.

### Copyright

Copyright 2019 Google LLC

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
