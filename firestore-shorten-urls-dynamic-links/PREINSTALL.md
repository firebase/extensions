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
