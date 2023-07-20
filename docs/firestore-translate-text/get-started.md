# Get started

## **Using the Translate Text in Firestore extension**

The Translate Text in Firestore extension (`firestore-translate-text`) lets you translate strings written to a Cloud Firestore collection into multiple languages using the [Cloud Translation API](https://cloud.google.com/translate). Adding a document to the collection triggers this extension to translate the contents of a field within a document to one or more languages. The extension supports either translating a single string or multiple strings at once.

Here’s a basic example document write that would trigger this extension:

```js
admin.firestore().collection("translations").add({
  input: "Hello from Firebase!",
});
```

When the extension triggers, the input text would update the document with translations:

```js
{
  input: 'Hello from Firebase!',
  translations: {
    'fr': 'Bonjour de Firebase!',
    'de': 'Hallo von Firebase!',
  },
}
```

If the original non-translated field of the document is updated, then the translations will be automatically updated, as well.

## **Pre-installation setup**

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart)
 in your Firebase project.

## **Install the extension**

To install the extension, follow the steps on the [Install Firebase Extension](https://firebase.google.com/docs/extensions/install-extensions) page. In summary, do one of the following:

- **Firebase console:** Click the following button:
  [Install the Trigger Email from Firestore extension](https://console.firebase.google.com/project/_/extensions/install?ref=firebase%2Ffirestore-translate-text)
- **CLI:** Run the following command:
  ```bash
  firebase ext:install firebase/firestore-translate-text --project=projectId-or-alias
  ```

When you install the extension, you will be prompted to specify the collection to target, the document input field and the list of country codes to be translated.

- **Cloud Functions location:**
  Select the location of where you want to deploy the functions created for this extension. You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).
- **Target languages for translations, as a comma-separated list:**
  Into which target languages do you want to translate new strings? The languages are identified using ISO-639-1 codes in a comma-separated list, for example: en,es,de,fr. For these codes, visit the list of the [supported languages](https://cloud.google.com/translate/docs/languages).
- **Collection path:**
  What is the path to the collection that contains the strings that you want to translate?
- **Input field name:**
  What is the name of the field that contains the string that you want to translate?
- **Translations output field name:**
  What is the name of the field where you want to store your translations?

## Multiple collections for translations

To translate multiple collections, install this extension multiple times, specifying a different collection path each time. There is currently no limit on how many instances of an extension you can install.

## \***\*Multiple field translations\*\***

To translate multiple fields, store a map of input strings in the input field:

```js
admin.firestore().collection("translations").add({
  first: "My name is Bob",
  second: "Hello, friend",
});
```
