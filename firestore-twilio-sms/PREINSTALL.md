Use this extension to render and send SMS messages that contain the information from documents added to a specified Cloud Firestore collection.

Adding a document triggers this extension to send an SMS built from the document's fields. The document's top-level fields specify the sender (`from`) and recipient (`to`). The document's `message` field specifies the content of the message, namely `body` and `mediaUrl` (optional).

Here's a basic example document write that would trigger this extension:

```js
admin
  .firestore()
  .collection("mail")
  .add({
    to: "+14055551212",
    message: {
      body: "Hello from Firebase!",
    },
  });
```

You can also optionally configure this extension to render emails using [Handlebars](https://handlebarsjs.com/) templates. Each template is a document stored in a Cloud Firestore collection.

When you configure this extension, you'll need to supply your **Twilio account credentials**.

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Firestore
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

Usage of this extension also requires you to have SMTP credentials for mail delivery. You are responsible for any associated costs with your usage of your SMTP provider.
