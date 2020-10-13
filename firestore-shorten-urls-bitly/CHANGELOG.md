## Version 0.1.5

feature - Add new Cloud Functions locations. For more information about locations and their pricing tiers, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

## Version 0.1.4

feature - Update Cloud Functions runtime to Node.js 10.

## Version 0.1.3

fixed - Fixed 406 HTTP error code from Bitly API due to `Content-Type` header not being set (#202).

## Version 0.1.2

fixed - Migrated Bitly API to v4 since v3 will be deactivated on March 1, 2020 (Issue #170).

**Important:** Update your extension to at minimum v0.1.2 before March 1, 2020; otherwise, your installed extension will stop working. [Learn more](https://dev.bitly.com/deprecated.html).

## Version 0.1.1

fixed - Fixed "cold start" errors experienced when the extension runs after a period of inactivity (issue #48).

## Version 0.1.0

Initial release of the _Shorten URLs_ extension.
