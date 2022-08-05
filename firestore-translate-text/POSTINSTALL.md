### See it in action

You can test out this extension right away!

1.  Go to your [Cloud Firestore dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/firestore/data) in the Firebase console.

1.  If it doesn't exist already, create a collection called `${param:COLLECTION_PATH}`.

1.  Create a document with a field named `${param:INPUT_FIELD_NAME}`, then make its value a word or phrase that you want to translate.

1.  In a few seconds, you'll see a new field called `${param:OUTPUT_FIELD_NAME}` pop up in the same document you just created. It will contain the translations for each language you specified during installation. 

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

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
