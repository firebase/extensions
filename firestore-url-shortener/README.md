# firestore-url-shortener

**VERSION**: 0.1.0

**DESCRIPTION**: Automatically shorten URLs written to a specified collection in Cloud Firestore using the Bitly API. Both the original and shortened URLs are stored in the same document.



**CONFIGURATION PARAMETERS:**

* Deployment location: *Where should the mod be deployed? You usually want a location close to your database. For help selecting a location, visit  https://firebase.google.com/docs/functions/locations#selecting_regions_for_firestore_and_storage.*

* Bitly access token: *What is your Bitly access token? Generate this access token at https://bitly.com/a/oauth_apps.
*

* Collection path: *What is the path to the collection that contains the URLs that you want to shorten?
*

* URL field name: *What is the name of the field that contains the original long URLs that you want to shorten?
*

* Short URL field name: *What is the name of the field where you want to store your shortened URLs?
*



**CLOUD FUNCTIONS CREATED:**

* fsurlshortener (providers/cloud.firestore/eventTypes/document.write)



**DETAILS**: Use this mod to create shortened URLs from URLs written to your Cloud Firestore instance. These shortened URLs are useful as display URLs.

This mod listens to your specified Cloud Firestore collection, then shortens any URL added to a specified field in any document within that collection. This mod shortens the URL then saves it in a new field in the same document.

If the original URL in a document is updated, then the shortened URL will be automatically updated, too.

This mod uses Bitly to shorten URLs, so you'll need to supply your Bitly access token as part of this mod's installation. You can generate this access token at https://bitly.com/a/oauth_apps.



**ACCESS REQUIRED**:



This mod will operate with the following project IAM roles:

* datastore.user (Reason: Allows the mod to write shortened URLs to Cloud Firestore.)
