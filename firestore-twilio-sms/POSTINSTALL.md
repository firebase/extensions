### See it in action

You can test out this extension right away:

1.  Go to your [Cloud Firestore dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/firestore/data).

1.  If it doesn't already exist, create the collection you specified during installation: `${param:SMS_COLLECTION}`.

1.  Add a document with a `to` field and a `message` field with the following content:

    ```
    to: '+14055551212',
    message: {
      body: 'Hello from Firebase!',
    }
    ```

1.  In a few seconds, you'll see a `delivery` field appear in the document. The field will update as the extension processes the message.

**Note:** You can also use the [Firebase Admin SDK][admin_sdk] to add a document:

```
admin.firestore().collection('${param:SMS_COLLECTION}').add({
  to: '+14055551212',
  message: {
    body: 'Hello from Firebase!',
  }
}).then(() => console.log('Queued SMS for delivery!'));
```

### Using this extension

After its installation, this extension monitors all document writes to the `${param:SMS_COLLECTION}` collection. SMS messages are delivered based on the contents of the document's fields. The top-level fields specify the message's sender and recipient. The `message` field contains the contents of the message to deliver.

#### Sender and recipient fields

The top-level fields of the document supply the email sender and recipient information. Available fields are:

- **from:** The sending SMS number (in [E.164 format](e164)), already provisioned in your Twilio account. If not specified in the document, uses the configured "Default from number" parameter.
- **to:** A single recipient phone number (in [E.164 format](e164)).
- **toUid:** A UID of a user with a populated `tel` field.

**NOTE:** The `toUid` option delivers a message based on user UIDs keyed to phone numbers within a Cloud Firestore document. To use these recipient options, you need to specify a Cloud Firestore collection for the extension's "Users collection" parameter. The extension can then read the `tel` field for a UID specified in the `toUids` field.

#### Message field

The `message` field of the document contains raw delivery information for the email. This field should generally only be populated by trusted code running in your own servers or Cloud Functions (refer to the "Security rules and sending email" section below).

Available properties for the `message` field are:

- **body:** The content of the text message.
- **mediaUrl:** A publicly accessible URL of media content to be sent as MMS.

#### Using templates

If you specified a "Templates collection" parameter during configuration of the extension, you can create and manage [Handlebars][handlebars] templates for your emails. Each document for a template should have a memorable ID that you use as the _template name_ in the document that's written to your `${param:SMS_COLLECTION}` collection.

The template document can include any of the following fields:

- **body:** A template string for the body of the text message.
- **mediaUrl:** A template string for a URL to attach as MMS.

An example template might have an ID of `following` and content like:

```js
{
  body: "@{{username}} is now following you!",
  mediaUrl: "https://my-assets.example.com/users/{{username}}.png"
}
```

To deliver messages using templates, when adding documents to your `${param:SMS_COLLECTION}` collection, include a `template` field with `name` and `data` properties. For example, using our `following` template from above:

```js
admin
  .firestore()
  .collection("${param:SMS_COLLECTION}")
  .add({
    toUid: "abc123",
    template: {
      name: "following",
      data: {
        username: "ada",
        name: "Ada Lovelace",
      },
    },
  });
```

#### Security rules and sending text messages

This extension can be used to trigger email delivery directly from client applications. However, you should carefully control client access to the `${param:SMS_COLLECTION}` collection to avoid potential abuse (you don't want users able to send arbitrary emails from your company's address!).

Security rules will vary from application to application, but you should always make sure that emails are sent only to intended recipients and free-form content is kept to a minimum. Templates can help here -- you can use security rules to verify that the data being populated to the template matches your expectations for what a user should be allowed to trigger.

#### Email delivery processing

When a document is added to the `${param:SMS_COLLECTION}` collection, the extension picks it up for email delivery processing. The extension creates and updates a `delivery` field in the document as it processes the email. The `delivery` field can be populated with the following fields:

- **state:** One of `PENDING`, `PROCESSING`, `QUEUED`, `SENDING`, `SENT`, `DELIVERED`, `UNDELIVERED`, `FAILED`, or `ERROR`.
- **startTime:** Timestamp when email processing began.
- **endTime:** Timestamp when email processing completed (that is, ended in either a `SUCCESS` or `ERROR` state).
- **error:** If there was an email delivery error, an error message will be populated here.
- **attempts:** Number of delivery attempts for this email.
- **leaseExpireTime:** In case of a hang or timeout, the time at which a `PROCESSING` state should be considered an error.
- **info:** Twilio API [MessageInstance](message_instance) contents.

An email will typically go from `PENDING` to `PROCESSING` to `QUEUED` to either `SENT` or `FAILED`, and potentially to `DELIVERED` or `UNDELIVERED`. Once in a terminal state, additional changes to the document will not trigger the extension to send another message. To resend an message with document updates, you can change the `state` to `PENDING` or `RETRY`.

#### Manual retries

There are instances in which email delivery fails in a recoverable fashion or the document can be manually corrected for proper delivery with minor modifications. While retries are not automatic, you can manually change the `state` in the `delivery` field to `RETRY` so that the extension attempts email delivery again (and increments the number of `attempts`).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.

[e164]: https://www.twilio.com/docs/glossary/what-e164
[sms_collection]: https://console.firebase.google.com/project/_/database/firestore/data~2F${param:SMS_COLLECTION}
[admin_sdk]: https://firebase.google.com/docs/admin/setup
[handlebars]: https://handlebarsjs.com/
[message_instance]: https://www.twilio.com/docs/libraries/reference/twilio-node/3.37.1/Twilio.Api.V2010.AccountContext.MessageInstance.html
