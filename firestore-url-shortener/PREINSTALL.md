Use this extension to create shortened URLs from URLs written to your Cloud Firestore instance. These shortened URLs are useful as display URLs.

This extension listens to your specified Cloud Firestore collection, then shortens any URL added to a specified field in any document within that collection. This extension shortens the URL then saves it in a new field in the same document.

If the original URL in a document is updated, then the shortened URL will be automatically updated, too.

This extension uses Bitly to shorten URLs, so you'll need to supply your Bitly access token as part of this extension's installation. You can generate this access token using [Bitly](https://bitly.com/a/oauth_apps).

When you use Firebase Extensions, you're only charged for the underlying resources that you use. Firebase Extensions themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
