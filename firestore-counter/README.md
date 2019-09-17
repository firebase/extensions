# firestore-counter

**VERSION**: 0.1.0

**DESCRIPTION**: Records event counters at scale to accommodate high-velocity writes to Cloud Firestore.



**CONFIGURATION PARAMETERS:**

* Deployment location: *Where should the extension be deployed? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).*

* Document path for internal state: *What is the path to the document where the extension can keep its internal state?*



**NON-CLOUD FUNCTION RESOURCES CREATED**:

* controller (firebaseextensions.v1beta.function)

* onWrite (firebaseextensions.v1beta.function)

* worker (firebaseextensions.v1beta.function)



**DETAILS**: Use this extension to add a highly scalable counter service to your app. This is ideal for applications that count viral actions or any very high-velocity action such as views, likes, or shares.

In your app, you specify a Cloud Firestore document path and increment a field value by any amount you choose. The extension then creates a subcollection in that document to help track the counter in a scalable way.

Note that this extension is for use with the JavaScript apps and requires the Firebase JavaScript SDK.

### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

After installation, you'll need to update your database security rules and set up a [scheduled function](https://firebase.google.com/docs/functions/schedule-functions) to regularly call one of the functions created by this extension. Detailed information for these post-installation tasks are provided after you install this extension.

This extension provides a Counter SDK that you need to install in your app. You can then use this library in your code to specify your document path and increment values. Detailed instructions to install this SDK and use it are provided after you install this extension.

### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Firestore
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)



**ACCESS REQUIRED**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to aggregate Cloud Firestore counter shards.)
