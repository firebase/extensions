# Limit database entries in Realtime Database

**Description**: Limit the number of nodes, such as the lines of a chat history, to your specified maximum count in your specified Firebase Realtime Database path.



**Details**: Use this mod to control the maximum number of nodes stored in a Firebase Realtime Database path.

If the number of nodes in your specified Realtime Database path exceeds the specified max count, this mod deletes the oldest nodes first until there are the max count number of nodes remaining.

We recommend adding data via pushing, for example `firebase.database().ref().child('posts').push()`, because pushing assigns an automatically generated ID to the node in the database. During retrieval, these nodes are guaranteed to be ordered by the time they were added. Learn more about reading and writing data for your platform (iOS, Android, or Web) in the [Realtime Database documentation](https://firebase.google.com/docs/database/).

When you use Firebase Mods, you're only charged for the underlying resources that you use. Firebase Mods themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)




**Configuration Parameters:**

* Deployment location: Where should the mod be deployed? You usually want a location close to your database. Realtime Database instances are located in us-central1. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Realtime Database path: What is the Realtime Database path for which you want to limit the number of child nodes?

* Maximum count of nodes to keep: What is the maximum count of nodes to keep in your specified database path? The oldest nodes will be deleted first to maintain this max count.



**Cloud Functions:**

* **rtdblimit:** Listens for new child nodes in your specified Realtime Database path, checks if the max count has been exceeded, then deletes the oldest nodes first, as needed to maintain the max count.



**Access Required**:



This mod will operate with the following project IAM roles:

* firebasedatabase.admin (Reason: Allows the mod to delete nodes from your Realtime Database instance.)
