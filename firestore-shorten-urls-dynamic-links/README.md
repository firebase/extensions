# Shorten URLs with Dynamic Links

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Shortens URLs written to a specified Cloud Firestore collection using Firebase Dynamic Links.

**Public Alpha**: This extension is available for testing as a _public alpha_ release. It has not been as thoroughly tested as the officially released extensions, and future updates might introduce breaking changes.

To install this extension, open the [installation page](https://console.firebase.google.com/project/_/extensions/install?sourceName=projects/firebasemods/sources/b085f422-e03a-4f89-9868-e8b692c72cb3) in the Firebase console.

If you use this extension, please [report bugs and make feature requests](https://github.com/firebase/extensions/issues/new/choose) in our GitHub repository.

**Details**: Use this extension to create shortened URLs from URLs written to Cloud
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




**Configuration Parameters:**

* Deployment location: Where should the extension be deployed? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Dynamic Links URL prefix: What URL prefix do you want for your shortened links? You will need to set up this prefix in the [Dynamic Links](https://console.firebase.google.com/project/${PROJECT_ID}/durablelinks) section of the console.


* Dynamic Links suffix length: Do you want your short links to end with the shortest possible suffix or longer suffixes that are unlikely to be guessable? In general, you can use short suffixes as long as there's no harm in someone successfuly guessing a short link.


* Collection path: What is the path to the collection that contains the URLs that you want to shorten?


* URL field name: What is the name of the field that contains the original long URLs that you want to shorten?


* Short URL field name: What is the name of the field where you want to store your shortened URLs?




**Cloud Functions:**

* **shorten_create:** Listens for new documents in your specified Cloud Firestore collection, and if they contain URLs, shortens the URLs, then writes the shortened form back to the same document.

* **shorten_update:** Listens for writes of new URLs to your specified Cloud Firestore collection, shortens the URLs, then writes the shortened form back to the same document.



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to write shortened URLs to Cloud Firestore.)
