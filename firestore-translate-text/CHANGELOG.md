## Version 0.1.22

feat - move to Node.js 20 runtimes

## Version 0.1.21

feat - update docs and config setup for AI Translations with Gemini

docs - add disclaimer about prompt injection

## Version 0.1.20

feat - add optional Gemini translations powered by Firebase Genkit

## Version 0.1.19

fixed - bump dependencies, fix vulnerabilities

## Version 0.1.18

fixed - bump dependencies, fix vulnerabilities (#2061)

## Version 0.1.17

fixed - updated vulnerable dependencies

## Version 0.1.16

fix - temporarily disable backfill feature

## Version 0.1.15

fix - handle array values correctly in backfill

## Version 0.1.14

build - updated depenencies

## Version 0.1.13

feature - bump to node 18

## Version 0.1.12

feature - bump to nodejs16

## Version 0.1.11

No changes.

## Version 0.1.10

feature - upgrade extensions to the latest firebase-admin sdk

feature - add optional languages field param

## Version 0.1.9

feature - add lifecycle event to translate existing documents in the collection.

## Version 0.1.8

fixed - generate correct `package-lock.json` files after `lerna bootstrap` (#779)

fixed - update validate workflow to use node14

## Version 0.1.7

feature - add Taiwan and Singapore Cloud Function locations (#729)

## Version 0.1.6

feature - added Warsaw (europe-central2) location (#677)

feature - updated Cloud Functions runtime to Node.js 14 (#660)

fixed - Removed code coverage check on ci

## Version 0.1.5

docs - Improved documentation for input fields of type [`Map`](https://firebase.google.com/docs/firestore/manage-data/data-types#data_types).

## Version 0.1.4

feature - Support an input field of type [`Map`](https://firebase.google.com/docs/firestore/manage-data/data-types#data_types). If input is a `Map`, every value will be translated.

feature - Add new Cloud Functions locations. For more information about locations and their pricing tiers, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

## Version 0.1.3

feature - Update Cloud Functions runtime to Node.js 10.

## Version 0.1.2

fixed - Fixed bug where target languages could not be reconfigured.

## Version 0.1.1

fixed - Fixed bug where param validation failed when a single language was entered.

fixed - Fixed "cold start" errors experienced when the extension runs after a period of inactivity (issue #48).

## Version 0.1.0

Initial release of the _Translate Text_ extension.
