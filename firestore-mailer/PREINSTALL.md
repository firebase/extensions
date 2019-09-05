Use this extension to render and send emails that contain the information from documents added to Cloud Firestore.

Adding a document triggers this extension to send an email built from the document's fields. The document's top-level fields specify the email sender and recipients, including `to`, `cc`, and `bcc` options (each supporting UIDs). The document's `message` field specifies the other email elements, like subject line and email body (either plaintext or HTML)

Here's a basic example documment write that would trigger this extension:

```js
admin.firestore().collection('mail').add({
  to: ['someone@example.com'],
  message: {
    subject: 'Hello from Firebase!',
    html: 'This is an <code>HTML</code> email body.',
  },
})
```

Because each email is built from a Cloud Firestore document, you can reference information stored in _other_ Cloud Firestore documents and fields, like image URLs.

You can also optionally configure this extension to render emails using [Handlebar](https://handlebarsjs.com/) templates. Each template is a document stored in a Cloud Firestore collection.

When you configure this extension, you'll need to supply your **SMTP credentials for mail delivery** and specify the Cloud Firestore collection where you'll add documents. If you want to use templates, you'll also need to specify the collection containing your template documents.

When you use Firebase Extensions, you're only charged for the underlying resources that you use. Firebase Extensions themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
