Use this mod to add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high velocity action such as views, likes, or shares.

Note that this mod is for use with the JavaScript apps and requires the Firebase JavaScript SDK.

This mod includes an SDK to install in your app which lets you specify a path to a Cloud Firestore document and increment a field value by any amount you choose. The mod creates a subcollection in your specified document to help track the counter in a scalable way.

After installation, you'll need to set up a [scheduled function](https://firebase.google.com/docs/functions/schedule-functions) to help the controller function (`${function:controller.url}`).
