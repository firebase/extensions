# Scalable counter service

**Description**: Keep an accurate account of events in your app that happen at high velocity, such as number of views and likes.



**Details**: Use this mod to add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high velocity action such as views, likes, or shares.

Note that this mod is for use with the JavaScript apps and requires the Firebase JavaScript SDK.

This mod includes an SDK to install in your app which lets you specify a path to a Cloud Firestore document and increment a field value by any amount you choose. The mod creates a subcollection in your specified document to help track the counter in a scalable way.

After installation, you'll need to set up a [scheduled function](https://firebase.google.com/docs/functions/schedule-functions) to help the controller function.

When you use Firebase Mods, you're only charged for the underlying resources that you use. Firebase Mods themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)




**Configuration Parameters:**

* Deployment location: Where should the mod be deployed? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Document path for internal state: What is the path to the document where the mod can keep its internal state?



**Cloud Functions:**

* **controller:** Scheduled to run every minute. This function either aggregates shards itself, or it schedules and monitors workers to aggregate shards.

* **onWrite:** Listens for changes on documents that may need incrementing.

* **worker:** Monitors a range of shards and aggregates them, as needed. There may be 0 or more worker functions running at any point in time. The controller function is responsible for scheduling and monitoring these workers.



**Access Required**:



This mod will operate with the following project IAM roles:

* datastore.user (Reason: Allows the mod to aggregate Cloud Firestore counter shards.)
