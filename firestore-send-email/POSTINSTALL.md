### See it in action

You can test out this extension right away!

1.  Go to your [Cloud Firestore dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/firestore/data) in the Firebase console. Note that, if you have configured a non-default firestore database, you may have to view it via the [Google Cloud Console](https://console.cloud.google.com/firestore/databases/${param:DATABASE}).

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

#### Firestore-Send-Email: SendGrid Categories

When using SendGrid (`SMTP_CONNECTION_URI` includes `sendgrid.net`), you can assign categories to your emails.

##### Example JSON with Categories:
```json
{
  "to": ["example@example.com"],
  "categories": ["Example_Category"],
  "message": {
    "subject": "Test Email with Categories",
    "text": "This is a test email to see if categories work.",
    "html": "<strong>This is a test email to see if categories work.</strong>"
  }
}
```

Add this document to the Firestore mail collection to send categorized emails.

For more details, see the [SendGrid Categories documentation](https://docs.sendgrid.com/ui/sending-email/categories).

#### Firestore-Send-Email: SendGrid Dynamic Templates

When using SendGrid, you can use SendGrid Dynamic Templates to create and send templated emails.

## Example JSON representation of Firestore document for a Dynamic Template:
```json
{
  "to": ["example@example.com"],
  "sendGrid": {
    "templateId": "d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "dynamicTemplateData": {
      "name": "John Doe",
      "company": "Example Corp",
      "position": "Developer"
    }
  }
}
```

Add this document to the Firestore mail collection to send an email using a SendGrid Dynamic Template. The `templateId` is required and should be your SendGrid Dynamic Template ID (always starts with 'd-'). The `dynamicTemplateData` object contains the variables that will be used in your template.

For more details, see the [SendGrid Dynamic Templates documentation](https://docs.sendgrid.com/ui/sending-email/how-to-send-an-email-with-dynamic-templates).

#### Understanding SendGrid Email IDs

When an email is sent successfully, the extension tracks two different IDs in the delivery information:

- **Queue ID**: This is SendGrid's internal queue identifier (from the `x-message-id` header). It's useful for tracking the email within SendGrid's system.
- **Message ID**: This is the RFC-2822 Message-ID header, which is a standard email identifier used across email systems.

You can find both IDs in the `delivery.info` field of your email document after successful delivery:

```json
{
  "delivery": {
    "info": {
      "messageId": "<unique-message-id@your-domain.com>",
      "sendgridQueueId": "sendgrid-queue-id",
      "accepted": ["recipient@example.com"],
      "rejected": [],
      "pending": [],
      "response": "status=202"
    }
  }
}
```

### Automatic Deletion of Email Documents

To use Firestore's TTL feature for automatic deletion of expired email documents, the extension provides several configuration parameters.

The extension will set a TTL field in the email documents, but you will need to manually configure a TTL policy for the collection/collection group the extension targets, on the `delivery.expireAt` field.

Detailed instructions for creating a TTL field can be found in the [Firestore TTL Policy documentation](https://firebase.google.com/docs/firestore/ttl).


### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.

[mail_collection]: https://console.firebase.google.com/project/_/firestore/data~2F${param:MAIL_COLLECTION}
[admin_sdk]: https://firebase.google.com/docs/admin/setup
[amp4email]: https://amp.dev/documentation/guides-and-tutorials/learn/email-spec/amp-email-format/
[handlebars]: https://handlebarsjs.com/

### Further reading & resources

You can find more information about this extension in the following articles:

- [Sending Emails Using Firestore And Firebase Extensions](https://invertase.link/Y6Nu)