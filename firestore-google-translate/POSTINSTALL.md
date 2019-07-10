Whenever a string is written to the field `${param:MESSAGE_FIELD_NAME}` in `${param:COLLECTION_PATH}`, this mod translates the string into your specified target language(s). The source language of the string is automatically detected. This mod adds the translated string to `${param:TRANSLATIONS_FIELD_NAME}` in the same document using the following format:

```
{
  ${param:MESSAGE_FIELD_NAME}: 'My name is Bob',
  ${param:TRANSLATIONS_FIELD_NAME}: {
    de: 'Ich heiße Bob',
    en: 'My name is Bob',
    es: 'Mi nombre es Bob',
    fr: 'Je m'appelle Bob',
  },
}
```

This mod translates the text into the target languages: `${param:LANGUAGES}` (using ISO-639-1 codes). You can find a list of valid languages and their corresponding codes in the [Cloud Translate API documentation](https://cloud.google.com/translate/docs/languages).

If the `${param:MESSAGE_FIELD_NAME}` field of the document is updated, then the translations will be automatically updated, as well.
