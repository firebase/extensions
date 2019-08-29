### See it in action

To test out this extension, add a document with a `to` field and a `message` field to the `${param:MAIL_COLLECTION}` collection in the [Firebase console][mail_collection] or using the [Firebase Admin SDK][admin_sdk]:

```
admin.firestore().collection('${param:MAIL_COLLECTION}').add({
  to: ['someone@example.com'],
  message: {
    subject: 'Hello from Firebase!',
    text: 'This is the plaintext section of the email body.',
    html: 'This is the <code>HTML</code> section of the email body.',
  }
}).then(() => console.log('Queued email for delivery!'));
```

### Use this extension

After its installation, this extension monitors all document writes to the `${param:MAIL_COLLECTION}` collection. Email is delivered based on the contents of the document's fields. The top-level fields specify the email's sender and recipients. The `message` field contains the details of the email to deliver, including the email body.

#### Sender and recipient fields

The top-level fields of the document supply the email sender and recipient information. Available fields are:

* **from:** The sender's email address. If not specified in the document, uses the configured "Default FROM address" parameter.
* **replyTo:** The reply-to email address. If not specified in the document, uses the configured "Default REPLY-TO address" parameter.
* **to:** An array containing the recipient email addresses.
* **toUids:** An array containing the recipient UIDs.
* **cc:** An array containing the CC recipient email addresses.
* **ccUids:** An array containing the CC recipient UIDs.
* **bcc:** An array containing the BCC recipient email addresses.
* **bccUids:** An array containing the BCC recipient UIDs.

**NOTE:** The `toUids`, `ccUids`, and `bccUids` options deliver emails based on user UIDs keyed to email addresses within a Cloud Firestore document. To use these recipient options, you need to specify a Cloud Firestore collection for the extension's "User collection" parameter. The extension can then read the `email` field for each UID specified in the `toUids`, `ccUids`, and/or `bccUids` fields.

#### Message field

The `message` field of the document contains raw delivery information for the email. This field should generally only be populated by trusted code running in your own servers or Cloud Functions (refer to the "Security rules and sending email" section below).

Available properties for the `message` field are:

* **messageId:** A message ID header for the email, if any.
* **subject:** The subject of the email.
* **text:** The plaintext content of the email.
* **html:** The HTML content of the email.
* **amp:** The [AMP4EMAIL][amp4email] content of the email.

#### Using templates

If you specified a "Templates collection" parameter during configuration of the extension, you can create and manage [Handlebars][handlebars] templates for your emails. Each document for a template should have a memorable ID that you use as the *template name* in the document that's written to your `${param:MAIL_COLLECTION}` collection.

The template document can include any of the following fields:

* **subject:** A template string for the subject of the email.
* **text:** A template string for the plaintext content of the email.
* **html:** A template string for the HTML content of the email.
* **amp:** A template string for the [AMP4EMAIL][amp4email] content of the email.

An example template might have an ID of `following` and content like:

```js
{
  subject: "@{{username}} is now following you!",
  html: "Just writing to let you know that <code>@{{username}}</code> ({{name}}) is now following you."
}
```

To deliver email using templates, when adding documents to your `${param:MAIL_COLLECTION}` collection, include a `template` field with `name` and `data` properties. For example, using our `following` template from above:

```js
admin.firestore().collection('${param:MAIL_COLLECTION}').add({
  toUids: ['abc123'],
  template: {
    name: 'following',
    data: {
      username: 'ada',
      name: 'Ada Lovelace'
    }
  }
})
```

#### Security rules and sending email

This extension can be used to trigger email delivery directly from client applications. However, you should carefully control client access to the `${param:MAIL_COLLECTION}` collection to avoid potential abuse (you don't want users able to send arbitrary emails from your company's address!).

Security rules will vary from application to application, but you should always make sure that emails are sent only to intended recipients and free-form content is kept to a minimum. Templates can help here -- you can use security rules to verify that the data being populated to the template matches your expectations for what a user should be allowed to trigger.

#### Email delivery processing

When a document is added to the `${param:MAIL_COLLECTION}` collection, the extension picks it up for email delivery processing. The extension creates and updates a `delivery` field in the document as it processes the email. The `delivery` field can be populated with the following fields:

* **state:** One of `PENDING`, `PROCESSING`, `SUCCESS`, or `ERROR`.
* **startTime:** Timestamp when email processing began.
* **endTime:** Timestamp when email processing completed (that is, ended in either a `SUCCESS` or `ERROR` state).
* **error:** If there was an email delivery error, an error message will be populated here.
* **attempts:** Number of delivery attempts for this email.
* **leaseTimeExpires:** In case of a hang or timeout, the time at which a `PROCESSING` state should be considered an error.
* **info:** After successful email delivery (to at least one address), this field will be populated with the following fields:
  * **messageId:** The message ID of the delivered email.
  * **accepted:** Array of email addresses to which the email was successfully delivered.
  * **rejected:** Array of email addresses to which the email could not be delivered.
  * **pending:** Array of email addresses that were temporarily rejected by SMTP.
  * **response:** The last response from the SMTP server.

A email will typically go from `PENDING` to `PROCESSING` to either `SUCCESS` or `ERROR`. Once in the `SUCCESS` or `ERROR` state, additional changes to the document will not trigger additional computation.

#### Manual retries

There are instances in which email delivery fails in a recoverable fashion or the document can be manually corrected for proper delivery with minor modifications. While retries are not automatic, you can manually change the `state` in the `delivery` field to `RETRY` so that the extension attempts email delivery again (and increments the number of `attempts`).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.

[mail_collection]: https://console.firebase.google.com/project/_/database/firestore/data~2F${param:MAIL_COLLECTION}
[admin_sdk]: https://firebase.google.com/docs/admin/setup
[amp4email]: https://amp.dev/documentation/guides-and-tutorials/learn/email-spec/amp-email-format/
[handlebars]: https://handlebarsjs.com/
