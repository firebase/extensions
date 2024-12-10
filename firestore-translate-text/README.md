# Translate Text in Firestore

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Translates strings written to a Cloud Firestore collection into multiple languages (uses Cloud Translation API).



**Details**: Use this extension to translate strings (for example, text messages) written to a Cloud Firestore collection.

This extension listens to your specified Cloud Firestore collection. If you add a string to a specified field in any document within that collection, this extension:

- Translates the string into your specified target language(s); the source language of the string is automatically detected.
- Adds the translation(s) of the string to a separate specified field in the same document.

You specify the desired target languages using ISO-639-1 codes. You can find a list of valid languages and their corresponding codes in the [Cloud Translation API documentation](https://cloud.google.com/translate/docs/languages).

If the original non-translated field of the document is updated, then the translations will be automatically updated, as well.

#### Multiple collections for translations

To translate multiple collections, install this extension multiple times, specifying a different
collection path each time. There is currently no limit on how many instances of an extension you
can install.

#### Multiple field translations

To translate multiple fields, store a map of input strings in the input field:

```js
admin.firestore().collection('translations').add({
  first: "My name is Bob",
  second: "Hello, friend"
})
```
#### Multiple languages

To translate text into multiple languages, set the `languages` parameter to a comma-separated list
of languages, such as `en,fr,de`. See the [supported languages list](https://cloud.google.com/translate/docs/languages).
#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

#### AI Translations using Gemini

This extension optionally supports using Gemini 1.5 Pro as an alternative to the Google Cloud Translation API for performing translations.

The extension accesses the Gemini API via Google AI, and will require an API key to be provided upon installation. You may create an API key [here](https://ai.google.dev/gemini-api/docs/api-key).

A large language model like Gemini 1.5 Pro may have more contextual understanding. For example in the sentence `I left my keys in the bank` the model may understand whether `bank` refers to a financial institution or a riverbank, and may provide a more accurate translation.

It is important to note that Gemini should only be used with sanitized input, as prompt injection is a possibility.

##### Notes:
- Using the Gemini API may have a different pricing model than the Cloud Translation API.

#### Billing
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
  - Cloud Translation API
  - Cloud Firestore
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))




**Configuration Parameters:**

* Target languages for translations, as a comma-separated list: Into which target languages do you want to translate new strings? The languages are identified using ISO-639-1 codes in a comma-separated list, for example: en,es,de,fr. For these codes, visit the [supported languages list](https://cloud.google.com/translate/docs/languages).


* Collection path: What is the path to the collection that contains the strings that you want to translate?


* Input field name: What is the name of the field that contains the string that you want to translate?


* Translations output field name: What is the name of the field where you want to store your translations?


* Languages field name: What is the name of the field that contains the languages that you want to translate into? This field is optional. If you don't specify it, the extension will use the languages specified in the LANGUAGES parameter.


* Translation Model: This extension provides the option to use Gemini 1.5 Pro for translations, which may provide more accurate and context-aware translations. The extension accesses the Gemini API using a Google AI API key that you can provide as a secret during installation.


* Google AI API key: If you selected AI Translations Using Gemini to perform translations, please provide a Google AI API key, which you can create here: https://ai.google.dev/gemini-api/docs/api-key


* Translate existing documents?: Should existing documents in the Firestore collection be translated as well?  If you've added new languages since a document was translated, this will fill those in as well.




**Cloud Functions:**

* **fstranslate:** Listens for writes of new strings to your specified Cloud Firestore collection, translates the strings, then writes the translated strings back to the same document.

* **fstranslatebackfill:** Searches your specified Cloud Firestore collection for existing documents, translates the strings into any missing languages, then writes the translated strings back to the same document.



**APIs Used**:

* translate.googleapis.com (Reason: To use Google Translate to translate strings into your specified target languages.)



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to write translated strings to Cloud Firestore.)
