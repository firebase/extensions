# Handle Resize Image Extension events

## Extension events

Extension events allow you to plug into the runtime of the extension and extend its functionality with your own code. This way, the extension becomes a baseline of your integration, but you can still build on top of it to make it your own.

## Resize Image Extension events

The extension can publish a resize completion event which you can optionally enable when you install the extension. The event includes more details about the specific formats and sizes. If you enable events, you can write custom event handlers that respond to these events. You can always enable or disable events later. Events will be emitted via [Eventarc](https://cloud.google.com/eventarc/docs/overview).

## **Handle custom events**

You can handle custom events published by extensions using the `onCustomEventPublished` handler. First, import this handler from the Eventarc SDK along with the Firebase Admin SDK for Node.js for your custom logic and the `logger`SDK for handling errors:

Ensure you have the latest firebase-functions package installed.

```js
{
 "firebase-functions": "^3.21.1"
}
```

```js
const { onCustomEventPublished } = require("firebase-functions/v2/eventarc");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
```

In your function code, pass in the event name as shown for the example function `onimageresized`:

```js
exports.onimageresized = onCustomEventPublished(
  "firebase.extensions.storage-resize-images.v1.complete",
  (event) => {
    logger.info("Received image resize completed event", event);
    // For example, write resized image details into Firestore.
    return getFirestore()
      .collection("images")
      .doc(event.subject.replace("/", "_")) // original file path
      .set(event.data); // resized images paths and sizes
  }
);
```

For each particular extension, the payload returned in the event object provides data you can use to perform custom logic for your application flow. In this case, the function uses the Admin SDK to copy metadata about the resized image to a collection in Firestore, obtaining the filename from the `subject` provided by the event, and saving metadata from the `data` provided by the event.

> For more information about handling custom events refer [Create and handle custom event triggers](https://firebase.google.com/docs/functions/beta/custom-events).
