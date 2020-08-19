## Version 0.1.4

fixed - updated `firebase-tools` dependency to avoid using deprecated `gcp-metadata` API (Issue #206).

**Important:** If you use this extension to delete user data from Cloud Firestore, you must update your extension to at minimum v0.1.4 before April 30, 2020. Otherwise, your installed extension will stop working. No further action is required.

## Version 0.1.3

feature - Support deletion of directories (issue #148).

## Version 0.1.2

feature - Add a new param for recursively deleting subcollections in Cloud Firestore (issue #14).
fixed - Fixed "cold start" errors experienced when the extension runs after a period of inactivity (issue #48).

## Version 0.1.1

Initial release of the _Delete User Data_ extension.
