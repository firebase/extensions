Use this mod to translate strings (for example, text messages) written to a Cloud Firestore collection.

### How it works

Whenever a string is written to a specified field in any document within your specified Cloud Firestore collection, this mod translates the string into your specified target language(s). The source language of the string is automatically detected. This mod adds the translated string to a separate specified field in the same document.

You specify the desired target languages using ISO-639-1 codes. You can find a list of valid languages and their corresponding codes in the [Cloud Translate API documentation](https://cloud.google.com/translate/docs/languages).

If the original non-translated field of the document is updated, then the translations will be automatically updated, as well.

### Additional setup required

None. This mod will start working right away.

### Cost implications

When you use Firebase Mods, you're only charged for the underlying resources that you use. Firebase Mods themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
