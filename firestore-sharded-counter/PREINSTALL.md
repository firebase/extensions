Use this extension to add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high velocity action such as views, likes, or shares.

Note that this extension is for use with the JavaScript apps and requires the Firebase JavaScript SDK.

This extension includes an SDK to install in your app which lets you specify a path to a Cloud Firestore document and increment a field value by any amount you choose. The extension creates a subcollection in your specified document to help track the counter in a scalable way.

After installation, you'll need to set up a [scheduled function](https://firebase.google.com/docs/functions/schedule-functions) to help the controller function.

When you use Firebase Extensions, you're only charged for the underlying resources that you use. Firebase Extensions themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
