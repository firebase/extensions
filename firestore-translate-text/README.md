# Translate Text

**Description**: Translates strings written to a Cloud Firestore collection into multiple languages (uses Cloud Translation API).



**Details**: Use this extension to translate strings (for example, text messages) written to a Cloud Firestore collection.

This extension listens to your specified Cloud Firestore collection. If you add a string to a specified field in any document within that collection, this extension:

- Translates the string into your specified target language(s); the source language of the string is automatically detected.
- Adds the translation(s) of the string to a separate specified field in the same document.

You specify the desired target languages using ISO-639-1 codes. You can find a list of valid languages and their corresponding codes in the [Cloud Translation API documentation](https://cloud.google.com/translate/docs/languages).

If the original non-translated field of the document is updated, then the translations will be automatically updated, as well.

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Translation API
- Cloud Firestore
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Target languages for translations, as a comma-separated list: Into which target languages do you want to translate new strings? The languages are identified using ISO-639-1 codes in a comma-separated list, for example: en,es,de,fr. For these codes, visit the [supported languages list](https://cloud.google.com/translate/docs/languages).


* Collection path: What is the path to the collection that contains the strings that you want to translate?


* Input field name: What is the name of the field that contains the string that you want to translate?


* Translations output field name: What is the name of the field where you want to store your translations?




**Cloud Functions:**

* **fstranslate:** Listens for writes of new strings to your specified Cloud Firestore collection, translates the strings, then writes the translated strings back to the same document.



**APIs Used**:

* translate.googleapis.com (Reason: To use Google Translate to translate strings into your specified target languages.)



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to write translated strings to Cloud Firestore.)
