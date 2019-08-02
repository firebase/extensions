# Translate text strings in Cloud Firestore

**Description**: Translate strings written to a Cloud Firestore collection into one or more languages. Both the original text string and translated text string are stored in the same document.



**Details**: Use this mod to translate strings (for example, text messages) written to a Cloud Firestore collection.

Whenever a string is written to a specified field in any document within your specified Cloud Firestore collection, this mod translates the string into your specified target language(s). The source language of the string is automatically detected. This mod adds the translated string to a separate specified field in the same document.

You specify the desired target languages using ISO-639-1 codes. You can find a list of valid languages and their corresponding codes in the [Cloud Translate API documentation](https://cloud.google.com/translate/docs/languages).

If the original non-translated field of the document is updated, then the translations will be automatically updated, as well.

When you use Firebase Mods, you're only charged for the underlying resources that you use. Firebase Mods themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)




**Configuration Parameters:**

* Deployment location: Where should the mod be deployed? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations#selecting_regions_for_firestore_and_storage).

* Target languages for translations, as a comma-separated list: Into which target languages do you want to translate new strings? The languages are identifed using ISO-639-1 codes in a comma-separated list, for example: en,es,de,fr. For these codes, visit the [supported languages list](https://cloud.google.com/translate/docs/languages).


* Collection path: What is the path to the collection that contains the strings that you want to translate?


* Message field name: What is the name of the field that contains the strings that you want to translate?


* Translations field name: What is the name of the field where you want to store your translations?




**Cloud Functions:**

* **fstranslate:** Listens for writes of new strings to your specified Cloud Firestore collection, translates the strings, then writes the translated strings back to the same document.



**APIs Used**:

* translate.googleapis.com (Reason: To use Google Translate to translate strings into your specified target languages.)



**Access Required**:



This mod will operate with the following project IAM roles:

* datastore.user (Reason: Allows the mod to write translated strings to Cloud Firestore.)
