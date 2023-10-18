### See it in action

You can test out this extension right away!

1.  Go to your [Cloud Firestore dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/firestore/data) in the Firebase console.

1.  If it doesn't already exist, create the collection you specified during installation: `${param:MAIL_COLLECTION}`.

1.  Add a document with a `to` field and a `message` field with the following content:

    ```js
    to: ['someone@example.com'],
    message: {
      subject: 'Hello from Firebase!',
      text: 'This is the plaintext section of the email body.',
      html: 'This is the <code>HTML</code> section of the email body.',
    }
    ```

1.  In a few seconds, you'll see a `delivery` field appear in the document. The field will update as the extension processes the email.

**Note:** You can also use the [Firebase Admin SDK][admin_sdk] to add a document:

```js
admin
  .firestore()
  .collection("${param:MAIL_COLLECTION}")
  .add({
    to: "someone@example.com",
    message: {
      subject: "Hello from Firebase!",
      text: "This is the plaintext section of the email body.",
      html: "This is the <code>HTML</code> section of the email body.",
    },
  })
  .then(() => console.log("Queued email for delivery!"));
```

### Using this extension

See the [official documentation](https://firebase.google.com/docs/extensions/official/firestore-send-email) for information on using this extension, including advanced use cases such as using Handlebars templates and managing email delivery status.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.

[mail_collection]: https://console.firebase.google.com/project/_/firestore/data~2F${param:MAIL_COLLECTION}
[admin_sdk]: https://firebase.google.com/docs/admin/setup
[amp4email]: https://amp.dev/documentation/guides-and-tutorials/learn/email-spec/amp-email-format/
[handlebars]: https://handlebarsjs.com/

### Further reading & resources

You can find more information about this extension in the following articles:

- [Sending Emails Using Firestore And Firebase Extensions](https://invertase.link/Y6Nu)