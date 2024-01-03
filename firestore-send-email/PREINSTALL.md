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

#### Setup Google App Passwords

**Google** no longer allows **Gmail** users to use their own passwords to authorize third-party apps and services. Instead, you have to use the [Sign in with App Passwords](https://support.google.com/accounts/answer/185833) service to generate a special password for each app you want to authorize. To do so:

1.  Go to your [Google Account](https://myaccount.google.com/).
2.  Select **Security**.
3.  Under "Signing in to Google," select **App Passwords**. You may need to sign in. If you don’t have this option, it might be because:
    1.  2-Step Verification is not set up for your account.
    2.  2-Step Verification is only set up for security keys.
    3.  Your account is through work, school, or other organization.
    4.  You turned on Advanced Protection.
4.  At the bottom, choose **Select app** and choose **Other** option and then write the name of the app password (e.g. `Firebase Trigger Email from Firestore Extension`) and click **Generate**.
5.  Follow the instructions to enter the App Password. The App Password is the 16-character code in the yellow bar on your device.
6.  Tap **Done**.

Now you can use your Google username with the generated password to authorize the extension.

#### Setup Hotmail Passwords

To use your Outlook/Hotmail email account with this extension, you'll need to have 2FA enabled on your account, and [Create an App Password](https://support.microsoft.com/en-us/help/12409/microsoft-account-app-passwords-and-two-step-verification).

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Firestore database](https://firebase.google.com/docs/firestore/quickstart) in your Firebase project.

#### Billing
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
  - Cloud Firestore
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))

Usage of this extension also requires you to have SMTP credentials for mail delivery. You are responsible for any associated costs with your usage of your SMTP provider.

#### Further reading & resources

You can find more information about this extension in the following articles:

- [Sending Emails Using Firestore And Firebase Extensions](https://invertase.link/Y6Nu)