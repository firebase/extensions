Use this mod to create shortened URLs from URLs written to your Cloud Firestore instance. These shortened URLs are useful as display URLs.

This mod listens to your specified Cloud Firestore collection, then shortens any URL added to a specified field in any document within that collection. This mod shortens the URL then saves it in a new field in the same document.

If the original URL in a document is updated, then the shortened URL will be automatically updated, too.

This mod uses Bitly to shorten URLs, so you'll need to supply your Bitly access token as part of this mod's installation. You can generate this access token at https://bitly.com/a/oauth_apps.
