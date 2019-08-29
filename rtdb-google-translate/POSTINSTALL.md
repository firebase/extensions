### See it in action

To test out this extension, run the following commands using the Firebase CLI:

```
firebase database:push /${param:TRIGGER_PATH}/en --data '{"string": "I like to eat cake"}'
firebase database:push /${param:TRIGGER_PATH}/en --data '{"string": "Good morning! Good night."}'
```

When you go to the [Realtime Database tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/${param:PROJECT_ID}/data), you'll see your database populated with both the original strings and the translated strings, with a data structure similar to:

```
/${param:PROJECT_ID}
   /${param:TRIGGER_PATH}
       /en
           /<stringID-1234>
               "string": "https://google.com",
           /<stringID-4321>
               "string": "Good morning! Good night.",
       /<targetLanguageCode>
           /<stringID-1234>
               "string": "<translated-text-about-cake>",
           /<stringID-4321>
               "string": "<translated-text-about-greetings>",
```

### Use this extension

To trigger this extension, write strings to the database path: `${param:TRIGGER_PATH}/{sourceLanguageID}/{messageId}`. You can use any of the [Firebase Realtime Database SDKs](https://firebase.google.com/docs/database/). When triggered, the extension translates the string then writes the translated strings under new nodes within the same database path: `${param:TRIGGER_PATH}/{targetLanguageID}/{messageId}`.

The original, untranslated string must be a JSON resembling the following: `{"string": "This is your original, untranslated text."}`.

You specify the source language (and the target languages) using ISO-639-1 codes. You can find a list of valid languages and their corresponding codes in the [Cloud Translate API documentation](https://cloud.google.com/translate/docs/languages). The following are your configured desired target language(s): `${param:LANGUAGES}`.

If the original string in `${param:TRIGGER_PATH}/{sourceLanguageID}/{messageId}` is updated, then the translated strings will be automatically updated, too.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
