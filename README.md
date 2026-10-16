# Firebase Extensions

This repository contains the source for the official Firebase Extensions.

> **Deprecation Notice:** The Firebase Extensions service is deprecated and will shut down on March 31, 2027. Extensions that are already installed will keep running, but you won't be able to manage them after that date. We recommend migrating to function kits. See the [user migration guide](https://firebase.google.com/docs/extensions/users/migrate) and the [FAQ](https://firebase.google.com/docs/extensions/faq-and-troubleshooting) for details.

## Function kits

A function kit packages an extension's functionality as an npm package. You add it to your own Cloud Functions for Firebase (2nd gen) codebase and deploy it with the Firebase CLI, the same way you deploy your other functions, instead of installing a managed extension instance.

These kits are available:

| Extension | Function kit |
| --- | --- |
| `firestore-bigquery-export` | [`@firebase-function-kits/firestore-bigquery-export`](https://www.npmjs.com/package/@firebase-function-kits/firestore-bigquery-export) |

We're converting the remaining extensions into kits. To check whether a kit replacement exists for an extension you have installed, run `firebase ext:list` in your project, or open the Extensions page of the Firebase console.

If you publish your own extension, see the [publisher migration guide](https://firebase.google.com/docs/extensions/publishers/migrate).

## Extensions

Each directory in this repo contains the source code for an extension and a README explaining how it works, including the APIs it enables, the resources it creates, and the access it is granted. Fixes for the published extensions are still released from this repository.

To learn more about Firebase Extensions, visit the [Firebase documentation](https://firebase.google.com/docs/extensions).
