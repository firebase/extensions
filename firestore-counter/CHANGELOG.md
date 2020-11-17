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
