# firestore-sharded-counter

**VERSION**: 0.1.0

**DESCRIPTION**: Keep an accurate account of events in your app that happen at high velocity, such as number of views and likes.



**CONFIGURATION PARAMETERS:**

* Deployment location: *Where should the mod be deployed? You usually want a location close to your database. For help selecting a location, visit https://firebase.google.com/docs/functions/locations.*

* Document path for internal state: *What is the path to the document where the mod can keep its internal state?*



**CLOUD FUNCTIONS CREATED:**

* controller (HTTPS)

* onWrite (providers/cloud.firestore/eventTypes/document.write)

* worker (providers/cloud.firestore/eventTypes/document.write)



**DETAILS**: Use this mod to add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high velocity action such as views, likes, or shares.

Note that this mod is for use with the JavaScript apps and requires the Firebase JavaScript SDK.

This mod includes an SDK to install in your app which lets you specify a path to a Cloud Firestore document and increment a field value by any amount you choose. The mod creates a subcollection in your specified document to help track the counter in a scalable way.

After installation, you'll need to set up a [scheduled function](https://firebase.google.com/docs/functions/schedule-functions) to help the controller function (`${function:controller.url}`).



**ACCESS REQUIRED**:



This mod will operate with the following project IAM roles:

* datastore.user (Reason: Allows the mod to aggregate Cloud Firestore counter shards.)
