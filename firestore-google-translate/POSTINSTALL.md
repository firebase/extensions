### See it in action

To test out this mod, follow these steps:

1.  Go to the [Cloud Firestore tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data).

1.  If it doesn't exist already, create a collection called `${param:COLLECTION_PATH}`.

1.  Create a document with a field named `${param:MESSAGE_FIELD_NAME}` and make its value a word or phrase that you want to translate.

1.  In a few seconds, you'll see a new field called `${param:TRANSLATIONS_FIELD_NAME}` pop up in the same document you just created; it will contain the translations. 

### Using the mod

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

If the `${param:MESSAGE_FIELD_NAME}` field of the document is updated, then the translations will be automatically updated, as well.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/mods/manage-installed-mods#monitor) of your installed mod, including checks on its health, usage, and logs.
