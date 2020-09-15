### See it in action

You can test out this extension right away:

1.  Go to the [Cloud Firestore tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data).

1.  If it doesn't exist already, create a collection called `${param:COLLECTION_PATH}`.

1.  Create a document with a field named `${param:URL_FIELD_NAME}` and make its value a URL such as `https://github.com/firebase/firebase-tools`.

1.  In a few seconds, you'll see a new field called `${param:SHORT_URL_FIELD_NAME}` pop up in the same document you just created; it will contain the shortened URL.

### Using the extension

This extension listens to the Cloud Firestore collection `${param:COLLECTION_PATH}`. If you add a URL to the field `${param:URL_FIELD_NAME}` in any document within that collection, this extension:

- Shortens the URL.
- Saves the shortened URL in the `${param:SHORT_URL_FIELD_NAME}` field of the same document like so:

```
{
  ${param:URL_FIELD_NAME}: 'https://my.super.long-link.example.com/api/user/profile/-jEHitne10395-k3593085',
  ${param:SHORT_URL_FIELD_NAME}: 'https://yourapp.page.link/WXYZ',
}
```

If the original URL in a document is updated, then the shortened URL will be automatically updated, too.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.

### Even shorter links

If the `https://yourapp.page.link/WXYZ` links are still too long for you, or if
you want short links with your own branding, you can use your own domain for
your Dynamic Links. See [Set up a custom domain for Dynamic Links][custom-doc].

[custom-doc]: https://firebase.google.com/docs/dynamic-links/custom-domains
