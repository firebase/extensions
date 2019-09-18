# rtdb-translate-text

**VERSION**: 0.1.0

**DESCRIPTION**: Translates strings written to a Realtime Database path into multiple languages (uses Cloud Translation API).



**CONFIGURATION PARAMETERS:**

* Deployment location: Where should the extension be deployed? You usually want a location close to your database. Realtime Database instances are located in us-central1. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Target languages for translations, as a comma-separated list: Into which target languages do you want to translate new strings? The languages are identifed using ISO-639-1 codes in a comma-separated list, for example: en,es,de,fr. For these codes, visit the [supported languages list](https://cloud.google.com/translate/docs/languages).


* Trigger path: To which database path will new strings be written? For example, if you enter the path `messages`, then the extension will trigger upon writes to `messages/{sourceLanguageCode}/{messageId}`.




**CLOUD FUNCTIONS CREATED:**

* rtdbtranslate (providers/google.firebase.database/eventTypes/ref.write)



**DETAILS**: Use this extension to translate strings (for example, text messages) written to a Realtime Database path.

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

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:
- Cloud Translation API
- Firebase Realtime Database
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)



**APIS USED**:

* translate.googleapis.com (Reason: To use Google Translate to translate strings into your specified target languages.)



**ACCESS REQUIRED**:



This extension will operate with the following project IAM roles:

* firebasedatabase.admin (Reason: Allows the extension to write translated strings to your Realtime Database.)
