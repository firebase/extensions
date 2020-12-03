# Limit Child Nodes

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Limits the number of nodes to a specified maximum count in a specified Realtime Database path.



**Details**: Use this extension to control the maximum number of nodes stored in a Firebase Realtime Database path.

If the number of nodes in your specified Realtime Database path exceeds the specified max count, this extension deletes the oldest nodes first until there are the max count number of nodes remaining.

#### Additional setup

Before installing this extension, make sure that you've [set up a Realtime Database instance](https://firebase.google.com/docs/database) in your Firebase project.

### Billing
 
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)
 
- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s free tier:
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#expandable-24))
  - Firebase Realtime Database




**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension?  You usually want a location close to your database. Realtime Database  instances are located in `us-central1`. For help selecting a  location, refer to the [location selection  guide](https://firebase.google.com/docs/functions/locations).

* Realtime Database path: What is the Realtime Database path for which you want to limit the number of child nodes?

* Realtime Database: From which Realtime Database instance do you want to limit child nodes?


* Maximum count of nodes to keep: What is the maximum count of nodes to keep in your specified database path? The oldest nodes will be deleted first to maintain this max count.



**Cloud Functions:**

* **rtdblimit:** Listens for new child nodes in your specified Realtime Database path, checks if the max count has been exceeded, then deletes the oldest nodes first, as needed to maintain the max count.



**Access Required**:



This extension will operate with the following project IAM roles:

* firebasedatabase.admin (Reason: Allows the extension to delete nodes from your Realtime Database instance.)
