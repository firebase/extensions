Use this extension to translate strings (for example, text messages) written to a Realtime Database path.

This extension listens to your specified Realtime Database path. When a string is written to that path, this extension translates the string into your specified target language(s). The source language of the string is automatically detected. The extension then saves the translated strings under new nodes within your specified Realtime Database path.

The original, untranslated string must be a JSON resembling the following: `{"string": "This is your original, untranslated text."}`.

You specify the source language and the desired target languages using ISO-639-1 codes. You can find a list of valid languages and their corresponding codes in the [Cloud Translate API documentation](https://cloud.google.com/translate/docs/languages).

For example, you can configure this extension to trigger upon writes to the database path `YOUR_PATH/`, with target languages of Spanish and Dutch. If a URL is written to `YOUR_PATH/<sourceLanguageCode>/<messageID>`, this extension translates the string then writes the translated strings to paths in the form `YOUR_PATH/<targetLanguageCode>/<messageID>`, resulting in a data structure like so:

```
/your-project-id-123
  /YOUR_PATH
    /<sourceLanguageCode>
      /<messageID>
          string: "original, untranslated text",  // English
    /<targetLanguageCode-1>
       /<messageID>
           string: "texto original no traducido",  // Spanish
    /<targetLanguageCode-2>
       /<messageID>
           string: "originele, niet-vertaalde tekst",  // Dutch
```

If the original, untranslated string in the database path is updated, then the translated strings will be automatically updated, too.

This extension uses the Google Translate API for translations, which requires a billing account to use. Make sure to review the [pricing structure](https://cloud.google.com/translate/#pricing) for the Google Translate API.

When you use Firebase Extensions, you're only charged for the underlying resources that you use. Firebase Extensions themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
