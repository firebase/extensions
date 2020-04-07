# Trigger Email

**Description**: Composes and sends an email based on the contents of a document written to a specified Cloud Firestore collection.



**Details**: Use this extension to render and send emails that contain the information from documents added to a specified Cloud Firestore collection.

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

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

Usage of this extension also requires you to have SMTP credentials for mail delivery. You are responsible for any associated costs with your usage of your SMTP provider.




**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* SMTP connection URI: A URI representing an SMTP server that this extension can use to deliver email.

* Email documents collection: What is the path to the collection that contains the documents used to build and send the emails?

* Default FROM address: The email address to use as the sender's address (if it's not specified in the added email document).  You can optionally include a name with the email address (`Friendly Firebaser <foobar@example.com>`).

* Default REPLY-TO address: The email address to use as the reply-to address (if it's not specified in the added email document).

* Users collection: A collection of documents keyed by user UID. If the `toUids`, `ccUids`, and/or `bccUids` recipient options are used in the added email document, this extension delivers email to the `email` field based on lookups in this collection.

* Templates collection: A collection of email templates keyed by name. This extension can render an email using a [Handlebar](https://handlebarsjs.com/) template, if the template is specified in the added email document.



**Cloud Functions:**

* **processQueue:** Processes document changes in the specified Cloud Firestore collection, delivers emails, and updates the document with delivery status information.



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows this extension to access Cloud Firestore to read and process added email documents.)
