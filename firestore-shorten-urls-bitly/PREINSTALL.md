Use this extension to create shortened URLs from URLs written to Cloud Firestore. These shortened URLs are useful as display URLs.

This extension listens to your specified Cloud Firestore collection. If you add a URL to a specified field in any document within that collection, this extension:

- Shortens the URL.
- Saves the shortened URL in a new specified field in the same document.

If the original URL in a document is updated, then the shortened URL will be automatically updated, too.

This extension uses Bitly to shorten URLs, so you'll need to supply your Bitly access token as part of this extension's installation. You can generate this access token using [Bitly](https://bitly.com/a/oauth_apps).

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

You must also have a Bitly account and access token before installing this extension.

#### Billing
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
  - Cloud Firestore
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))
- This extension also uses these services:
  - [Bitly](https://bitly.com/). You must have a Bitly account and you're responsible for any associated charges.
