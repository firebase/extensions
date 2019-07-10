Use this mod to translate strings (for example, text messages) written to a Cloud Firestore collection.

Whenever a string is written to a specified field in any document within your specified Cloud Firestore collection, this mod translates the string into your specified target language(s). The source language of the string is automatically detected. This mod adds the translated string to a separate specified field in the same document.

You specify the desired target languages using ISO-639-1 codes. You can find a list of valid languages and their corresponding codes in the [Cloud Translate API documentation](https://cloud.google.com/translate/docs/languages).

If the original non-translated field of the document is updated, then the translations will be automatically updated, as well.
