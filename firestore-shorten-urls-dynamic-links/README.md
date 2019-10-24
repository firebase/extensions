# firestore-shorten-urls-dynamic-links

**VERSION**: 0.1.0

**DESCRIPTION**: Shortens URLs written to a specified Cloud Firestore
collection, using Dynamic Links

**CONFIGURATION PARAMETERS:**

* Deployment location: Where should the extension be deployed? You usually
  want a location close to your database. For help selecting a location,
  refer to the [location selection guide](https://firebase.google.com/docs/functions/locations#selecting_regions_for_firestore_and_storage).
* Dynamic Links URL prefix: What URL prefix do you want for your shortened
  links? You will need to set up this prefix in the
  [Dynamic Links](https://console.firebase.google.com/project/_/durablelinks)
  section of the console.
* Dynamic Links suffix length: Do you want your short links to end with the
  shortest possible suffix or longer suffixes that are unlikely to be
  guessable? In general, you can use short suffixes as long as there's no harm
  in someone successfuly guessing a short link.
* Collection path: What is the path to the collection that contains the URLs
  that you want to shorten?
* URL field name: What is the name of the field that contains the original
  long URLs that you want to shorten?
* Short URL field name: What is the name of the field where you want to store
  your shortened URLs?

**CLOUD FUNCTIONS CREATED:**

* fsurlshortener (providers/cloud.firestore/eventTypes/document.write)

**DETAILS**: Use this extension to create shortened URLs from URLs written to
Cloud Firestore, using Firebase Dynamic Links. These shortened URLs are useful
as display URLs.

This extension listens to your specified Cloud Firestore collection. If you add a
URL to a specified field in any document within that collection, this extension:

- Shortens the URL using Dynamic Links.
- Saves the shortened URL in a new specified field in the same document.

If the original URL in a document is updated, then the shortened URL will be
automatically updated, too.

#### Additional setup

Before installing this extension, make sure that you've
[set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart)
in your Firebase project.

You must also have a Dynamic Links URL prefix set up before installing this extension.
You can do so on the [Dynamic Links][dyn-links] section of the console. A Dynamic
Links URL prefix can use a free Google-hosted subdomain, such as in
`https://yourapp.page.link` or your own domain, such as in `https://example.com/ln`
or `https://e.xmp.le`.

[dyn-links]: https://console.firebase.google.com/project/${param:PROJECT_ID}/durablelinks

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may
have associated charges:

- Cloud Firestore
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying
resources that you use. A paid-tier billing plan is only required if the
extension uses a service that requires a paid-tier plan, for example calling
to a Google Cloud Platform API or making outbound network requests to
non-Google services. All Firebase services offer a free tier of usage.
[Learn more about Firebase billing.](https://firebase.google.com/pricing)

**ACCESS REQUIRED**:

This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to write shortened URLs to Cloud
  Firestore.)
