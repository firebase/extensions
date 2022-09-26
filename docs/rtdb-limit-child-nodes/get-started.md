# Get started

## Use the \***\*Limit Child Nodes extension\*\***

The Limit Child Nodes extension (`rtdb-limit-child-nodes`) lets you control the maximum number of nodes stored in a Firebase Realtime Database path. If the number of nodes in your specified Realtime Database path exceeds the specified max count, this extension deletes the oldest nodes first until there is the max count number of nodes remaining.

## Pre-installation setup

Before installing this extension, make sure that you've [set up a Realtime Database instance](https://firebase.google.com/docs/database)
 in your Firebase project.

## **Install the extension**

To install the extension, follow the steps on the [Install Firebase Extension](https://firebase.google.com/docs/extensions/install-extensions) page. In summary, do one of the following:

- **Firebase console:** Click the following button:

  [Install the Firestore Limit Child Nodes extensio](https://console.firebase.google.com/project/_/extensions/install?ref=firebase%2Frtdb-limit-child-nodes)[n](https://console.firebase.google.com/project/_/extensions/install?ref=firebase%2Ffirestore-bigquery-export)

- **CLI:** Run the following command:

  ```bash
  firebase ext:install firebase/storage-resize-images --project=projectId-or-alias
  ```

During the installation of the extension, you will be prompted to specify a number of configuration parameters:

- **Cloud Functions location:**

  Select the location of where you want to deploy the functions created for this extension. You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

- **Realtime Database path:**

  What is the Realtime Database path for which you want to limit the number of child nodes?

- **Realtime Database:**

  From which Realtime Database instance do you want to limit child nodes?

- **Maximum count of nodes to keep:**

  What is the maximum count of nodes to keep in your specified database path? The oldest nodes will be deleted first to maintain this max count.
