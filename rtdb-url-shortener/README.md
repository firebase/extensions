# rtdb-url-shortener

**VERSION**: 0.1.0

**DESCRIPTION**: Automatically shorten URLs written to your database using the Bitly API. Both the original and shortened URLs are stored in the same path.



**CONFIGURATION PARAMETERS:**

* Deployment location: *Where should the extension be deployed? You usually want a location close to your database. Realtime Database instances are located in us-central1. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).*

* Bitly access token: *What is your Bitly access token? Generate this access token using [Bitly](https://bitly.com/a/oauth_apps).
*

* Trigger path: *To which database path will original URLs be written? For example, if you enter the path `links`, then the extension will trigger upon writes to `links/{urlID}`.
*

* URL field name: *What is the name of the field that contains the original, long URLs that you want to shorten?
*

* Short URL field name: *What is the name of the field where you want to store your shortened URLs?
*



**CLOUD FUNCTIONS CREATED:**

* rtdburlshortener (providers/google.firebase.database/eventTypes/ref.write)



**DETAILS**: Use this extension to create shortened URLs from URLs written to a Realtime Database path. These shortened URLs are useful as display URLs.

This extension listens to your specified Realtime Database path. When any URL is written to that path, this extension shortens the URL then saves the shortened URL as a new field within the same database path.

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



**ACCESS REQUIRED**:



This mod will operate with the following project IAM roles:

* firebasedatabase.admin (Reason: Allows the mod to write shortened URLs to your Realtime Database.)
