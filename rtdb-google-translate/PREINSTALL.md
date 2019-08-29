Use this extension to translate strings (for example, text messages) written to a Realtime Database path.

This extension listens to your specified Realtime Database path. When a string is written to that path, this extension translates the string into your specified target language(s). The source language of the string is automatically detected. The extension then saves the translated strings under new nodes within the same database path.

The original, untranslated string must be a JSON resembling the following: `{"string": "This is your original, untranslated text."}`.

You specify the source language and the desired target languages using ISO-639-1 codes. You can find a list of valid languages and their corresponding codes in the [Cloud Translate API documentation](https://cloud.google.com/translate/docs/languages).

For example, you can configure this extension to trigger upon writes to the database path `YOUR_PATH/`. If a URL is written to `YOUR_PATH/<sourceLanguageID>/<messageID>`, this extension translates the string then writes the translated string to `YOUR_PATH/<targetLanguageID>/<messageID>`, resulting in a data structure like so:

```
/your-project-id-123
   /YOUR_PATH
      /<sourceLanguageID>
         /<messageID>
             string: "This is your original, untranslated text.",  // source language of English (en)
      /<targetLanguageID>
         /<messageID>
             string: "Este es su texto original no traducido.",  // target language of Spanish (es)
```

When you use Firebase Extensions, you're only charged for the underlying resources that you use. Firebase Extensions themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
