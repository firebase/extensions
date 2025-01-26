### See it in action

You can test out this extension right away!

1. Go to your [Cloud Firestore dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/firestore/data) in the Firebase console.

1. If it doesn't exist already, create a collection called `${param:COLLECTION_PATH}`.

1. Create a document with a field named `${param:INPUT_FIELD_NAME}`, then make its value a word or phrase that you want to translate.

1. In a few seconds, you'll see a new field called `${param:OUTPUT_FIELD_NAME}` pop up in the same document you just created. It will contain the translations for each language you specified during installation.

### Using the extension

This extension translates the input string(s) into your specified target language(s); the source language of the string is automatically detected. If the `${param:INPUT_FIELD_NAME}` field of the document is updated,
 then the translations will be automatically updated as well.

#### Input field as a string

Write the string "My name is Bob" to the field `${param:INPUT_FIELD_NAME}` in `${param:COLLECTION_PATH}` will result in the following translated output in `${param:OUTPUT_FIELD_NAME}`:

```js
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

#### Input field as a map of input strings

Create or update a document in `${param:COLLECTION_PATH}` with the field `${param:INPUT_FIELD_NAME}` value like the following:

```js
{
  first: "My name is Bob",
  second: "Hello, friend"
}
```

will result in the following translated output in `${param:OUTPUT_FIELD_NAME}`:

```js
{
  ${param:INPUT_FIELD_NAME}: {
    first: "My name is Bob",
    second: "Hello, friend"
  },
  
  ${param:OUTPUT_FIELD_NAME}: {
    first:{
      de: "Ich heiße Bob",
      en: "My name is Bob",
      es: "Mi nombre es Bob",
      fr: "Je m'appelle Bob",
    },
    second:{
      de: "Hallo Freund",
      en: "Hello, friend",
      es: "Hola amigo",
      fr: "Salut l'ami",
    },   
  },
}
```

### How to Use Glossaries with the Cloud Translation API

#### Enabling Glossaries

1. **Enable Translation Hub**: Before using glossaries, make sure that the [Translation Hub](https://console.cloud.google.com/translation/hub) is enabled for your project.
2. **Source Language Code**: When using glossaries, you must specify the source language. If no glossary is used, the source language can be automatically detected.

#### Steps to Create and Use a Glossary

1. **Create a Glossary**:
   - Use the [Google Cloud Translation API glossary creation guide](https://cloud.google.com/translate/docs/advanced/glossary) to create a glossary.
   - Store the glossary in the correct Google Cloud Storage bucket and ensure that the bucket's location matches your project's region.
   - Glossaries must be unique to the project and region.

2. **Specify the Glossary in the Extension**:
   - Provide the `GLOSSARY_ID` parameter during installation. This should match the ID of the glossary you created.
   - If using a glossary, also provide the `SOURCE_LANGUAGE_CODE` parameter to define the source language for your translations.

#### Example Usage

- Glossary ID: `city_names_glossary`
- Source Language Code: `en`

For example, if translating the phrase *"Paris is beautiful"* and your glossary specifies `Paris` to remain untranslated, the extension will ensure it remains in the source form.

#### Common Errors and Troubleshooting

- **Invalid Glossary ID**: Ensure the glossary ID is correct and case-sensitive.
- **Missing Source Language Code**: If using a glossary, a source language code is mandatory.
- **Glossary Not Found**: Confirm that the glossary exists in the correct project and region.

#### Links and Resources

- [Glossary Documentation](https://cloud.google.com/translate/docs/advanced/glossary)
- [Supported Languages List](https://cloud.google.com/translate/docs/languages)

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
