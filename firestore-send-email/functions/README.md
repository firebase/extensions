# Trigger Email

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

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
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s free tier:
  - Cloud Firestore
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#expandable-24))

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
