### See it in action

To test out this extension, follow these steps:

1.  Go to your [Cloud Firestore dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data).

1.  If it doesn't exist already, create a collection called `${param:COLLECTION_PATH}`.

1.  Create a document with a field named `${param:INPUT_FIELD_NAME}`, then make its value a word or phrase that you want to translate.

1.  In a few seconds, you'll see a new field called `${param:OUTPUT_FIELD_NAME}` pop up in the same document you just created. It will contain the translations for each language you specified during installation. 

### Using the extension

Whenever you write a string to the field `${param:INPUT_FIELD_NAME}` in `${param:COLLECTION_PATH}`, this extension:

- Translates the string into your specified target language(s); the source language of the string is automatically detected.
- Adds the translated string to `${param:OUTPUT_FIELD_NAME}` in the same document using the following format:

```
{
  ${param:INPUT_FIELD_NAME}: 'My name is Bob',
  ${param:OUTPUT_FIELD_NAME}: {
    de: 'Ich heiße Bob',
    en: 'My name is Bob',
    es: 'Mi nombre es Bob',
    fr: 'Je m'appelle Bob',
  },
}
```

By default, if the `${param:INPUT_FIELD_NAME}` field of the document is updated, then the translations will be automatically updated, as well. To skip re-translating the translations, set `${param:SHOULD_UPDATE}` to `false`.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
