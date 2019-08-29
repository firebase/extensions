Use this extension to create shortened URLs from URLs written to a Realtime Database path. These shortened URLs are useful as display URLs.

This extension listens to your specified Realtime Database path. This extension shortens any URL written to that path then saves the shortened URL as a new field within the same database path.

For example, you can configure this extension to trigger upon writes to the database path `YOUR_PATH/`. If a URL is written to `YOUR_PATH/<urlId>/<url>`, this extension shortens the original URL then writes the shortened URL to `YOUR_PATH/<urlId>/<shortUrl>`, resulting in a data structure like so:

```
/your-project-id-123
   /YOUR_PATH
       /url-123456
           url: "https://my.super.long-link.com/api/user/profile/-jEHitne10395-k3593085",
           shortUrl: "https://bit.ly/EKDdza"
```

If the original URL in the database path is updated, then the shortened URL will be automatically updated, too.

This extension uses Bitly to shorten URLs, so you'll need to supply your Bitly access token as part of this extension's installation. You can generate this access token using [Bitly](https://bitly.com/a/oauth_apps).

When you use Firebase Extensions, you're only charged for the underlying resources that you use. Firebase Extensions themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
