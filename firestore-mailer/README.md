# firestore-mailer

**VERSION**: 0.1.0

**DESCRIPTION**: Build and deliver emails from documents added to a Cloud Firestore collection.



**CONFIGURATION PARAMETERS:**

* Deployment location: *Where should the extension be deployed? For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).*

* SMTP connection URI: *A URI representing an SMTP server that this extension can use to deliver email.*

* Email documents collection: *What is the path to the collection that contains the documents used to build and send the emails?*

* Default FROM address: *The email address to use as the sender's address (if it's not specified in the added email document).*

* Default REPLY-TO address: *The email address to use as the reply-to address (if it's not specified in the added email document).*

* Users collection: *A collection of documents keyed by user UID. If the `toUids`, `ccUids`, and/or `bccUids` recipient options are used in the added email document, this extension delivers email to the `email` field based on lookups in this collection.*

* Templates collection: *A collection of email templates keyed by name. This extension can render an email using a [Handlebar](https://handlebarsjs.com/) template, if the template is specified in the added email document.*



**CLOUD FUNCTIONS CREATED:**

* processQueue (providers/cloud.firestore/eventTypes/document.write)



**DETAILS**: Use this extension to render and send emails that contain the information from documents added to Cloud Firestore.

Adding a document triggers this extension to send an email built from the document's fields. The document's top-level fields specify the email sender and recipients, including `to`, `cc`, and `bcc` options (each supporting UIDs). The document's `message` field specifies the other email elements, like subject line and email body (either plaintext or HTML)

Here's a basic example document write that would trigger this extension:

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



**ACCESS REQUIRED**:



This mod will operate with the following project IAM roles:

* datastore.user (Reason: Allows this extension to access Cloud Firestore to read and process added email documents.)
