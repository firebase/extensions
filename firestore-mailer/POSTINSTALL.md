### See it in action

To test out this mod, add a document with a `message` field to the `${param:MAIL_COLLECTION}` in the [Firebase console][mail_collection] or using the [Firebase Admin SDK][admin_sdk]:

```
admin.firestore().collection('${param:MAIL_COLLECTION}').add({
  message: {
    to: ["someone@example.com"],
    subject: "Hello from Firebase!",
    text: "Plaintext message.",
    html: "<b>HTML</b> message.",
  }
}).then(() => console.log("Queued message for mail!"));
```

### Using the mod

Once installed, all document writes to the `${param:MAIL_COLLECTION}` collection will automatically be monitored. Mail is delivered based on the contents of the `message` field. The message field contains the details of the email to deliver, including recipients and content. Message options are as follows:

#### Sender and Recipient(s)

Sender and recipient information is included in the top-level of the document. Available fields are:

* **from:** The sending email address. Will use the "Default From" parameter if not provided.
* **replyTo:** The reply to email address. Will use the "Default Reply-To" parameter if not provided.
* **to:** An array containing the recipient email addresses.
* **toUids:** An array containing the recipient UIDs.
* **cc:** An array containing the CC recipient email addresses.
* **ccUids:** An array containing the CC recipient UIDs.
* **bcc:** An array containing the BCC recipient email addresses.
* **bccUids:** An array containing the BCC recipient UIDs.

If you supplied a collection name to the "Users Collection" parameter, you can deliver messages based on user UIDs instead emails by using the `toUids`, `ccUids`, and `bccUids` options. The `email` field for each provided UID will be read from the provided collection and used for delivery.

#### Message Content

The `message` field of the document in the `${param:MAIL_COLLECTION}` collection contains raw delivery information for the email. This should generally only be populated by trusted code running in your own servers or Cloud Functions (see "Security Rules and Sending Mail" below).

* **messageId:** A message ID header for the email, if any.
* **subject:** The subject of the email.
* **text:** The plaintext content of the email.
* **html:** The HTML content of the email.
* **amp:** The [AMP4EMAIL][amp4email] content of the email.

#### Templated Content

If you suppplied a "Templates Collection" parameter, you can create and manage [Handlebars][handlebars] templates for your messages. Each document should have a memorable ID that will be used as the *template name*. The document can specify any of the following fields:

* **subject:** A template string for the message subject.
* **html:** A template string for the message HTML content.
* **text:** A template string for the message's plaintext content.
* **amp:** A template string for the message's AMP HTML content.

An example template might have an ID of `following` and content like:

```js
{
  subject: "@{{username}} is now following you!",
  html: "Just writing to let you know that <code>@{{username}}</code> ({{name}}) is now following you."
}
```

To deliver mail using templates, when adding documents to your `${param:MAIL_COLLECTION}` collection, supply a `template` field with `name` and `data` properties. For example, with our `following` template above:

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

#### Security Rules and Sending Mail

This extension can be used to trigger email delivery directly from client applications. However, you should carefully control client access to the `${param:MAIL_COLLECTION}` collection to avoid potential abuse (you don't want users able to send arbitrary emails from your company's address!). Rules will vary from application to application, but you should always make sure that messages are sent only to intended recipients and free-form content is kept to a minimum. Templates can help here -- you can verify that the data being populated to the template matches your expectations for what a user should be allowed to trigger.

#### Delivery Processing

Once a document is added to the `${param:MAIL_COLLECTION}`, the mod will automatically pick it up for delivery. A `delivery` field will be populated on the document as it's processed with the following fields:

* **state:** One of `PENDING`, `PROCESSING`, `SUCCESS`, or `ERROR`.
* **startTime:** Timestamp when processing began.
* **endTime:** Timestamp when processing completed (ended in `SUCCESS` or `ERROR` state).
* **error:** If there was a delivery error, an error message will be populated here.
* **attempts:** Number of delivery attempts for this message.
* **leaseTimeExpires:** In case of a hang or timeout, the time at which a `PROCESSING` state should be considered an error.
* **info:** After successful delivery (to at least one address), this will be populated with the following fields:
  * **messageId:** The message ID of the delivered email.
  * **accepted:** Array of email addresses to which the message was successfully delivered.
  * **rejected:** Array of email addresses to which the message could not be delivered.
  * **pending:** Array of email addresses that were temporarily rejected by SMTP.
  * **response:** The last response from the SMTP server.

A message will typically go from `PENDING` to `PROCESSING` to either `SUCCESS` or `ERROR`. Once in `SUCCESS` or `ERROR`, additional changes to the document will not trigger additional computation.

#### Manual Retries

There may be times when a message fails delivery in a recoverable fashion or can be manually corrected to delivery properly with minor modifications. While retries are not automatic, changing the `state` in the `delivery` field to `RETRY` will cause delivery to be attempted again, and the number of attempts will be increased.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/mods/manage-installed-mods#monitor) of your installed mod, including checks on its health, usage, and logs.

[mail_collection]: https://console.firebase.google.com/project/mods-sandbox-1/database/firestore/data~2F${param:MAIL_COLLECTION}
[admin_sdk]: https://firebase.google.com/docs/admin/setup
[amp4email]: https://amp.dev/documentation/guides-and-tutorials/learn/email-spec/amp-email-format/
[handlebars]: https://handlebarsjs.com/
