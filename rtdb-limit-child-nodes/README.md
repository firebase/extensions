# rtdb-limit-child-nodes

**VERSION**: 0.1.0

**DESCRIPTION**: Limits the number of nodes to a specified maximum count in a specified Realtime Database path.



**CONFIGURATION PARAMETERS:**

* Deployment location: *Where should the extension be deployed? You usually want a location close to your database. Realtime Database instances are located in us-central1. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).*

* Realtime Database path: *What is the Realtime Database path for which you want to limit the number of child nodes?*

* Maximum count of nodes to keep: *What is the maximum count of nodes to keep in your specified database path? The oldest nodes will be deleted first to maintain this max count.*



**NON-CLOUD FUNCTION RESOURCES CREATED**:

* rtdblimit (firebaseextensions.v1beta.function)



**DETAILS**: Use this extension to control the maximum number of nodes stored in a Firebase Realtime Database path.

If the number of nodes in your specified Realtime Database path exceeds the specified max count, this extension deletes the oldest nodes first until there are the max count number of nodes remaining.

### Additional setup

Before installing this extension, make sure that you've [set up a Realtime Database instance](https://firebase.google.com/docs/database) in your Firebase project.

### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Firebase Realtime Database
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)



**ACCESS REQUIRED**:



This extension will operate with the following project IAM roles:

* firebasedatabase.admin (Reason: Allows the extension to delete nodes from your Realtime Database instance.)
