The Mod will automatically translate the `${param:MESSAGE_FIELD_NAME}` field in Documents created in the Cloud Firestore Collection: `${param:COLLECTION_PATH}`.

The Mod will translate this message into the languages: `${param:LANGUAGES}` and output them in the `${param:TRANSLATIONS_FIELD_NAME}` field of the Document using the following format:

```
{
  ${param:MESSAGE_FIELD_NAME}: 'My name is Bob',
  ${param:TRANSLATIONS_FIELD_NAME}: {
    de: 'Ich heiße bob',
    en: 'My name is Bob',
    es: 'Mi nombre es Bob',
    fr: 'Je m'appelle Bob',
  },
}
```

The translation key is the ISO-639-1 language code. A list of valid languages and their corresponding codes can be found in the
[Cloud Translate official documentation](https://cloud.google.com/translate/docs/languages).

If the `${param:MESSAGE_FIELD_NAME}` field in the Document is updated, then the translations will be automatically updated as well.
