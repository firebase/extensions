Use this extension to create shortened URLs from URLs written to your Cloud Firestore instance. These shortened URLs are useful as display URLs.

This extension listens to your specified Cloud Firestore collection, then shortens any URL added to a specified field in any document within that collection. This extension shortens the URL then saves it in a new field in the same document.

If the original URL in a document is updated, then the shortened URL will be automatically updated, too.

This extension uses Bitly to shorten URLs, so you'll need to supply your Bitly access token as part of this extension's installation. You can generate this access token using [Bitly](https://bitly.com/a/oauth_apps).

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Firestore
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

Usage of this extension also requires you to have a Bit.ly account. You are responsible for any associated costs with your usage of Bit.ly.
