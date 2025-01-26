Use this extension to translate strings (for example, text messages) written to a Cloud Firestore collection.

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

##### Notes

- Using the Gemini API may have a different pricing model than the Cloud Translation API.

### How to Use Glossaries with the Cloud Translation API

#### Enabling Glossaries

1. **Enable Translation Hub**: Before using glossaries, make sure that the [Translation Hub](https://console.cloud.google.com/translation/hub) is enabled for your project.
2. **Source Language Code**: When using glossaries, you must specify the source language. If no glossary is used, the source language can be automatically detected.
3. **Case Sensitivity**: Glossary names are case-sensitive and must be entered precisely as created.

#### Steps to Create and Use a Glossary

1. **Create a Glossary**:
   - Use the [Google Cloud Translation API glossary creation guide](https://cloud.google.com/translate/docs/advanced/glossary) to create a glossary.
   - Store the glossary in the correct Google Cloud Storage bucket and ensure that the bucket's location matches your project's region.
   - Glossaries must be unique to the project and region.

2. **Specify the Glossary in the Extension**:
   - Provide the `GLOSSARY_ID` parameter during installation. This should match the ID of the glossary you created.
   - If using a glossary, also provide the `SOURCE_LANGUAGE_CODE` parameter to define the source language for your translations.

#### Example Usage

- Glossary ID: `city_names_glossary`
- Source Language Code: `en`

For example, if translating the phrase *"Paris is beautiful"* and your glossary specifies `Paris` to remain untranslated, the extension will ensure it remains in the source form.

#### Common Errors and Troubleshooting

- **Invalid Glossary ID**: Ensure the glossary ID is correct and case-sensitive.
- **Missing Source Language Code**: If using a glossary, a source language code is mandatory.
- **Glossary Not Found**: Confirm that the glossary exists in the correct project and region.

#### Links and Resources

- [Glossary Documentation](https://cloud.google.com/translate/docs/advanced/glossary)
- [Supported Languages List](https://cloud.google.com/translate/docs/languages)
- [Service Account Key Documentation](https://cloud.google.com/iam/docs/creating-managing-service-account-keys)

#### Billing

To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
  - Cloud Translation API
  - Cloud Firestore
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))
