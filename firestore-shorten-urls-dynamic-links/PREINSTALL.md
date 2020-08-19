Use this extension to create shortened URLs from URLs written to Cloud
Firestore, using Firebase Dynamic Links. These shortened URLs are useful as
display URLs.

This extension listens to your specified Cloud Firestore collection. If you
add a URL to a specified field in any document within that collection, this
extension:

- Shortens the URL using Dynamic Links.
- Saves the shortened URL in a new specified field in the same document.

If the original URL in a document is updated, then the shortened URL will be
automatically updated, too.

#### Additional setup

Before installing this extension, make sure that you've
[set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart)
in your Firebase project.

You must also have a Dynamic Links URL prefix set up before installing this
extension. You can do so on the [Dynamic Links][dyn-links] section of the
console. A Dynamic Links URL prefix can use a free Google-hosted subdomain,
such as in `https://yourapp.page.link` or your own domain, such as in
`https://example.com/link`.

[dyn-links]: https://console.firebase.google.com/project/${param:PROJECT_ID}/durablelinks

#### Billing

To install an extension, your project must be on the
[Blaze (pay as you go) plan][blaze-pricing].

-   You will be charged [around $0.01 per month][pricing-examples] for each
    instance of this extension you install.
-   This extension uses other Firebase and Google Cloud Platform services,
    which have associated charges if you exceed the service's free tier:
    -   Cloud Functions (Node.js 10+ runtime. [See FAQs][faq].)
    -   Cloud Firestore

[blaze-pricing]: https://firebase.google.com/pricing
[pricing-examples]: https://cloud.google.com/functions/pricing#pricing_examples
[faq]: https://firebase.google.com/support/faq#expandable-24
