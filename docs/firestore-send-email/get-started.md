# Get started

## Using the Trigger Email from Firestore extension

The Trigger Email from Firestore extension (`firestore-send-email`) lets you automatically send emails based on documents in a Cloud Firestore collection. Adding a document to the collection triggers this extension to send an email built from the document's fields. The document's top-level fields specify the email sender and recipients, including `to`, `cc`, and `bcc` options (each supporting UIDs). The document's `message` field specifies the other email elements, like the subject line and email body (either plaintext or HTML).

Here's a basic example document write that would trigger this extension:

```js
admin
  .firestore()
  .collection("mail")
  .add({
    to: "someone@example.com",
    message: {
      subject: "Hello from Firebase!",
      html: "This is an <code>HTML</code> email body.",
    },
  });
```

You can also optionally configure this extension to render emails using [Handlebars](https://firebase.google.com/docs/extensions/official/firestore-send-email/templates) templates.

## Pre-installation setup

Before you install the extension, complete these steps:

1. Set up your outgoing mail service.

   When you install the Trigger Email from Firestore extension, you will need to specify the connection and authentication details of an SMTP server, which the extension uses to send emails. This is typically provided by an email delivery service such as Sendgrid, Mailgun, or Mailchimp Transactional Email, but it could also be a server you run yourself.

2. Create an email documents collection.

   The Trigger Email from Firestore extension listens for new documents in a Cloud Firestore collection that you specify. When it finds a new document, the extension sends an email based on the document's fields. You can use any Cloud Firestore collection for this purpose; the examples on this page use a collection named `email`.

3. Set up security rules for your email documents collection.

   This extension can be used to trigger email delivery directly from client applications. However, you should carefully control client access to the collection to avoid potential abuse (you don't want users able to send arbitrary emails from your company's address!).

   Security rules will vary from application to application, but you should always make sure that emails are sent only to intended recipients and free-form content is kept to a minimum. Templates can help here—you can use security rules to verify that the data being populated to the template matches your expectations for what a user should be allowed to trigger.

4. Optional: Set up a users collection.

   Under basic usage of this extension, you specify the recipients of an email by specifying their email addresses in the `to`, `cc`, and `bcc` fields of the message document. As an alternative, if you have a user database in Cloud Firestore, you can specify receipients using the users' UIDs. For this to work, your users collection must meet these criteria:

   - The collection must be keyed on user IDs. That is, the document ID of each user document in the collection must be the user's Firebase Authentication UID.
   - Each user document must have an `email` field containing the user's email address.

5. Optional: Set up a templates collection.

   You can render emails using [Handlebars templates](https://handlebarsjs.com/). To do so, you will need a Cloud Firestore collection to contain your templates.

   See [Use Handlebars templates with the Trigger Email from Firestore extension](https://firebase.google.com/docs/extensions/official/firestore-send-email/templates) for details.

## Install the extension

To install the extension, follow the steps on the [Install a Firebase Extension](https://firebase.google.com/docs/extensions/install-extensions) page. In summary, do one of the following:

- **Firebase console:** Click the following button:

  [Install the Trigger Email from Firestore extension](https://console.firebase.google.com/project/_/extensions/install?ref=firebase/firestore-send-email)

- **CLI:** Run the following command:

  ```bash
  firebase ext:install firebase/firestore-send-email --project=projectId-or-alias
  ```

When you install the extension, you will be prompted to specify your SMTP connection information and the Cloud Firestore collections you set up earlier.

## Use the extension

After installation, this extension monitors all document writes to the collection you configured. Email is delivered based on the contents of the document's fields. The top-level fields specify the email's sender and recipients. The `message` field contains the details of the email to deliver, including the email body.

### Example: Send an email

To send a simple message, add a document to your messages collection with a `to` field and a `message` field with the following content:

```js
to: ['someone@example.com'],
message: {
  subject: 'Hello from Firebase!',
  text: 'This is the plaintext section of the email body.',
  html: 'This is the <code>HTML</code> section of the email body.',
}
```

### Sender and recipient fields

The top-level fields of the document supply the email sender and recipient information. Available fields are:

- **from:** The sender's email address. If not specified in the document, uses the configured "Default FROM address" parameter. This parameter does not work with [Gmail SMTP](https://nodemailer.com/usage/using-gmail/).
- **replyTo:** The reply-to email address. If not specified in the document, uses the configured "Default REPLY-TO address" parameter.
- **to:** A single recipient email address or an array containing multiple recipient email addresses.
- **toUids:** An array containing the recipient UIDs.
- **cc:** A single recipient email address or an array containing multiple recipient email addresses.
- **ccUids:** An array containing the CC recipient UIDs.
- **bcc:** A single recipient email address or an array containing multiple recipient email addresses.
- **bccUids:** An array containing the BCC recipient UIDs.
- **headers:** An object of additional header fields (for example, `{"X-Custom-Header": "value", "X-Second-Custom-Header": "value"}`).

**NOTE:** The `toUids`, `ccUids`, and `bccUids` options deliver emails based on user UIDs keyed to email addresses within a Cloud Firestore document. To use these recipient options, you need to specify a Cloud Firestore collection for the extension's "Users collection" parameter. The extension can then read the `email` field for each UID specified in the `toUids`, `ccUids`, and/or `bccUids` fields.

### Message field

The `message` field of the document contains raw delivery information for the email. This field should generally only be populated by trusted code running in your own servers or Cloud Functions (refer to the "Security rules and sending email" section below).

Available properties for the `message` field are:

- **messageId:** A message ID header for the email, if any.
- **subject:** The subject of the email.
- **text:** The plaintext content of the email.
- **html:** The HTML content of the email.
- **amp:** The [AMP4EMAIL](https://amp.dev/documentation/guides-and-tutorials/learn/email-spec/amp-email-format/) content of the email.
- **attachments:** An array containing attachment(s); [Nodemailer options](https://nodemailer.com/message/attachments/) supported: utf-8 string, custom content type, URL, encoded string, data URI, and pregenerated MIME node (be aware that your email has no access to the cloud server's file system).

## Advanced use

Learn about more advanced use of this extension:

- [Use Handlebars templates with the Trigger Email from Firestore extension](https://firebase.google.com/docs/extensions/official/firestore-send-email/templates)
- [Manage delivery status with the Trigger Email from Firestore extension](https://firebase.google.com/docs/extensions/official/firestore-send-email/delivery-status)
