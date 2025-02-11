## Version 0.2.12

feat - move to Node.js 20 runtimes

## Version 0.2.11

fixed - updated vulnerable dependencies

## Version 0.2.10

feature - add custom EventArc events

## Version 0.2.9

build - updated depenencies

## Version 0.2.8

feature - bump to node 18

## Version 0.2.7

feature - bump to nodejs16

## Version 0.2.6

fixed - web client now uses the document sub collection for processing shards

fixed - ts errors and updated packages

feature - upgrade extensions to the latest firebase-admin sdk

## Version 0.2.5

fixed - generate correct `package-lock.json` files after `lerna bootstrap` (#779)

fixed - update validate workflow to use node14

## Version 0.2.4

feature - Add Node.js Admin SDK implementation (#687)

feature - add Taiwan and Singapore Cloud Function locations (#729)

## Version 0.2.3

feature - added Warsaw (europe-central2) location (#677)

feature - updated Cloud Functions runtime to Node.js 14 (#660)

## Version 0.2.2

feature - Added Android client instructions for firestore-counter extension.

## Version 0.2.1

feature - addded iOS sample for firestore-counter extension.

## Version 0.2.0

feature - convert Firestore Counter to use scheduled functions (#353)

## Version 0.1.5

feature - Add new Cloud Functions locations. For more information about locations and their pricing tiers, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

## Version 0.1.4

feature - Update Cloud Functions runtime to Node.js 10.

## Version 0.1.3

build - Updates the firebase-admin and firebase-functions packages to the latest versions (issue #181).

## Version 0.1.2

feature - Limit shards to 100 documents, to optimize performance.

## Version 0.1.1

changed - Moves the logic for monitoring the extension's workload from the existing HTTP function to a new Pub/Sub controllerCore function. Now, if called, the HTTP function triggers the new `controllerCore` function instead. This change was made to accommodate a [change in the way Google Cloud Functions handles HTTP functions](https://cloud.google.com/functions/docs/securing/managing-access#allowing_unauthenticated_function_invocation).

We recommend that you edit your existing Cloud Scheduler job to instead send a message to the extension's Pub/Sub topic which triggers the new `controllerCore` function (detailed instructions provided in the [POSTINSTALL file](https://github.com/firebase/extensions/blob/master/firestore-counter/POSTINSTALL.md#set-up-a-cloud-scheduler-job). Although it's not recommended, if you leave your Cloud Scheduler job calling the HTTP function, your extension will continue to run as expected.

## Version 0.1.0

Initial release of the _Distributed Counter_ extension.
