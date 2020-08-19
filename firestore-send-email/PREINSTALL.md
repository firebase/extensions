Use this extension to render and send emails that contain the information from documents added to a specified Cloud Firestore collection.

Adding a document triggers this extension to send an email built from the document's fields. The document's top-level fields specify the email sender and recipients, including `to`, `cc`, and `bcc` options (each supporting UIDs). The document's `message` field specifies the other email elements, like subject line and email body (either plaintext or HTML)

Here's a basic example document write that would trigger this extension:

```js
admin.firestore().collection('mail').add({
  to: 'someone@example.com',
  message: {
    subject: 'Hello from Firebase!',
    html: 'This is an <code>HTML</code> email body.',
  },
})
```

You can also optionally configure this extension to render emails using [Handlebar](https://handlebarsjs.com/) templates. Each template is a document stored in a Cloud Firestore collection.

When you configure this extension, you'll need to supply your **SMTP credentials for mail delivery**. Note that this extension is for use with bulk email service providers, like SendGrid, Mailgun, etc.

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Firestore
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. Due to the services used by this extension, the Blaze plan is required. This extension’s Cloud functions will run on Node.js 10. You will be charged a small amount (less than $0.10) when you deploy this extension, including when you make configuration changes and apply future updates. [Read FAQs](https://firebase.google.com/support/faq#functions-pricing).

The Blaze plan also allows you to extend your project with paid Google Cloud Platform features. You pay only for the resources that you consume, allowing you to scale with demand. The Blaze plan also offers a generous [free tier](https://firebase.google.com/pricing) of usage.

Usage of this extension also requires you to have SMTP credentials for mail delivery. You are responsible for any associated costs with your usage of your SMTP provider.
