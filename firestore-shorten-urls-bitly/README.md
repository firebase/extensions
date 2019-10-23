# Shorten URLs

**Description**: Shortens URLs written to a specified Cloud Firestore collection (uses Bitly).



**Details**: Use this extension to create shortened URLs from URLs written to Cloud Firestore. These shortened URLs are useful as display URLs.

This extension listens to your specified Cloud Firestore collection. If you add a URL to a specified field in any document within that collection, this extension:

- Shortens the URL.
- Saves the shortened URL in a new specified field in the same document.

If the original URL in a document is updated, then the shortened URL will be automatically updated, too.

This extension uses Bitly to shorten URLs, so you'll need to supply your Bitly access token as part of this extension's installation. You can generate this access token using [Bitly](https://bitly.com/a/oauth_apps).

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

You must also have a Bit.ly account and access token before installing this extension.

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Firestore
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

Usage of this extension also requires you to have a Bit.ly account. You are responsible for any associated costs with your usage of Bit.ly.




**Configuration Parameters:**

* Deployment location: Where should the extension be deployed? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations#selecting_regions_for_firestore_and_storage).

* Bitly access token: What is your Bitly access token? Generate this access token using [Bitly](https://bitly.com/a/oauth_apps).


* Collection path: What is the path to the collection that contains the URLs that you want to shorten?


* URL field name: What is the name of the field that contains the original long URLs that you want to shorten?


* Short URL field name: What is the name of the field where you want to store your shortened URLs?




**Cloud Functions:**

* **fsurlshortener:** Listens for writes of new URLs to your specified Cloud Firestore collection, shortens the URLs, then writes the shortened form back to the same document.



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to write shortened URLs to Cloud Firestore.)
