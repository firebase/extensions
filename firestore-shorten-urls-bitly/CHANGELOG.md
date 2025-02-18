## Version 0.1.18

feat - move to Node.js 20 runtimes

## Version 0.1.17

fixed - bump dependencies, fix vulnerabilities

## Version 0.1.16

fixed - bump dependencies, fix vulnerabilities (#2061)

## Version 0.1.15

fixed - updated vulnerable dependencies

## Version 0.1.14

feature - add optional custom events

## Version 0.1.13

build - updated depenencies

## Version 0.1.12

feature - bump to node 18

## Version 0.1.11

feature - bump to nodejs16

## Version 0.1.10

No changes.

## Version 0.1.9

feature - upgrade extensions to the latest firebase-admin sdk

## Version 0.1.8

fixed - generate correct `package-lock.json` files after `lerna bootstrap` (#779)

fixed - update validate workflow to use node14

## Version 0.1.7

fixed - changed Bitly access token configuration from string type to secret type (#752)

feature - add Taiwan and Singapore Cloud Function locations (#729)

## Version 0.1.6

feature - added Warsaw (europe-central2) location (#677)

feature - updated Cloud Functions runtime to Node.js 14 (#660)

fixed - Removed code coverage check on ci

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
