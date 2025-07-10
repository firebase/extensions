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

This extension optionally supports using Gemini as an alternative to the Google Cloud Translation API for performing translations.

The extension can access the Gemini API via either Google AI (using an API key) or Vertex AI (using your Google Cloud project). If you choose Google AI, you will need to provide an API key upon installation, which you can create [here](https://ai.google.dev/gemini-api/docs/api-key). If you choose Vertex AI, the extension will use the Gemini models available in your Google Cloud project and does not require an API key.

Gemini models are large language models (LLMs), which can provide more contextual understanding than traditional translation APIs. For example, in the sentence `I left my keys in the bank`, an LLM may be able to determine whether `bank` refers to a financial institution or a riverbank, and provide a more accurate translation.

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


* Translation Engine: Choose the translation engine to use for this extension. "AI Translations Using Gemini" leverages Google's Gemini models for more accurate and context-aware translations, while "Cloud Translation API" uses the standard Google Cloud Translation service. If you select Gemini, you will need to provide a Google AI API key or use Vertex AI as the provider.


* Gemini Provider: Select the service to access the Gemini API for translations. Choose "Google AI" for the Gemini API via Google AI Studio, or "Vertex AI" to use Gemini models through Vertex AI in your Google Cloud project. This is only required if you select "AI Translations Using Gemini" as your translation model.


* Gemini Model: Choose the Gemini model to use for translations. Consider model pricing, performance, and availability in your selected provider. This is only required if you select "AI Translations Using Gemini" as your translation model. By default, the extension uses Gemini 2.5 Flash for a balance of speed and cost.


* Google AI API Key: If you selected "AI Translations Using Gemini" and "Google AI" as the provider, provide your Google AI API key here. You can create an API key at: https://ai.google.dev/gemini-api/docs/api-key. This is not required if you use Vertex AI as the provider.




**Cloud Functions:**

* **fstranslate:** Listens for writes of new strings to your specified Cloud Firestore collection, translates the strings, then writes the translated strings back to the same document.



**APIs Used**:

* translate.googleapis.com (Reason: To use Google Translate to translate strings into your specified target languages.)



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to write translated strings to Cloud Firestore.)
