## Version 0.1.24

feat - move to Node.js 20 runtimes

## Version 0.1.23

fixed - bump dependencies to fix vulnerabilities

## Version 0.1.22

fixed - recursive delete searched docs if enabled (#2073)

## Version 0.1.21

fixed - fix autodiscovery recursive deletion

fixed - update dependencies and fix vulnerabilities

## Version 0.1.20

fix - update regex for RTDB instance param

## Version 0.1.19

chore(delete-user-data): remove firebase-tools dependency

## Version 0.1.18

feature - bump to node 18

## Version 0.1.17

feature - bump to nodejs16

## Version 0.1.16

fixed - Increase UID checks on search based deletions

## Version 0.1.15

feature - upgrade extensions to the latest firebase-admin sdk

## Version 0.1.14

feature - add auto discovery mechanisms + update documentation

feature - upgrade to the latest emulator updates (#995)

fixed - generate correct `package-lock.json` files after `lerna bootstrap` (#779)

fixed - add RTDB locations function (#865)

fixed - updated typescript compiler

## Version 0.1.13

fixed - generate correct `package-lock.json` files after `lerna bootstrap` (#779)

fixed - add RTDB locations function (#865)

fixed - updated typescript compiler

fixed - update validate workflow to use node14

## Version 0.1.12

fixed - updated dependencies

## Version 0.1.11

feature - add Taiwan and Singapore Cloud Function locations (#729)

## Version 0.1.10

feature - updated RTDB to be optional (#722)

## Version 0.1.9

feature - added Warsaw (europe-central2) location (#677)

feature - updated Cloud Functions runtime to Node.js 14 (#660)

fixed - Removed code coverage check on ci

## Version 0.1.8

fixed - fixed an issue where delete-user-data didn't recognize {DEFAULT} Storage bucket (#532)

## Version 0.1.7

feature - Adds an option to select an alternative database instance (#505)

## Version 0.1.6

feature - Add new Cloud Functions locations. For more information about locations and their pricing tiers, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

## Version 0.1.5

feature - Update Cloud Functions runtime to Node.js 10.

## Version 0.1.4

fixed - Updated `firebase-tools` dependency to avoid using deprecated `gcp-metadata` API (Issue #206).

**Important:** If you use this extension to delete user data from Cloud Firestore, you must update your extension to at minimum v0.1.4 before April 30, 2020. Otherwise, your installed extension will stop working. No further action is required.

## Version 0.1.3

feature - Support deletion of directories (issue #148).

## Version 0.1.2

feature - Add a new param for recursively deleting subcollections in Cloud Firestore (issue #14).

fixed - Fixed "cold start" errors experienced when the extension runs after a period of inactivity (issue #48).

## Version 0.1.1

Initial release of the _Delete User Data_ extension.
