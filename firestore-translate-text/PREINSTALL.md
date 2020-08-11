Use this extension to translate strings (for example, text messages) written to a Cloud Firestore collection.

This extension listens to your specified Cloud Firestore collection. If you add a string to a specified field in any document within that collection, this extension:

- Translates the string into your specified target language(s); the source language of the string is automatically detected.
- Adds the translation(s) of the string to a separate specified field in the same document.

You specify the desired target languages using ISO-639-1 codes. You can find a list of valid languages and their corresponding codes in the [Cloud Translation API documentation](https://cloud.google.com/translate/docs/languages).

If the original non-translated field of the document is updated, then the translations will be automatically updated, as well.

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Translation API
- Cloud Firestore
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. Due to the services used by this extension, the Blaze plan is required. This extension’s Cloud functions will run on Node.js 10. You will be charged a small amount (less than $0.10) when you deploy this extension, including when you make configuration changes and apply future updates. [Read FAQs](https://firebase.google.com/support/faq#functions-pricing).

The Blaze plan also allows you to extend your project with paid Google Cloud Platform features. You pay only for the resources that you consume, allowing you to scale with demand. The Blaze plan also offers a generous [free tier](https://firebase.google.com/pricing) of usage.
