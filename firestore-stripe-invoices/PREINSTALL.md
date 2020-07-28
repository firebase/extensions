Use this extension to create and send brandable customer invoices using the payments platform [Stripe](https://www.stripe.com/).

The invoices are automatically customized with the logo and color theme of your business that you've set up in Stripe. After the invoice is sent, you can use the Stripe dashboard to track whether the customer has paid and how much money you processed with detailed reporting and charts.

This extension listens to your specified Cloud Firestore collection for new documents (like the example below). When you add a document, Stripe uses the invoice information in the document to create an invoice in their system then sends the invoice to the email address specified in the document. You can optionally manage your customer email addresses using [Firebase Authentication](https://firebase.google.com/docs/auth) user IDs.

```js
email: "customer@example.com",
items: [{
    amount: 2000,
    currency: "usd",
    description: "Growth plan"
}]
```

Here's an example of what your customized invoice will look like!

![An invoice page showing an itemized receipt, with options to pay with card or bank transfer](https://www.gstatic.com/mobilesdk/200421_mobilesdk/hosted-invoice-page.png)

An optional feature of this extension is to automatically update the invoice's status in its Cloud Firestore document. You can configure this feature after installing the extension by registering a Stripe webhook that listens for [Stripe invoice events](https://stripe.com/docs/api/events/types#event_types-invoice.created). If you want to use this optional feature, leave the parameter `Stripe webhook secret` empty during installation, then reconfigure your installed extension later with the actual value for your registered webhook. More details about this process are provided after installation.

#### Additional setup

Before installing this extension, set up the following Firebase services in your Firebase project:

- [Cloud Firestore](https://firebase.google.com/docs/firestore) to store invoice information and optionally invoice status
- [Firebase Authentication](https://firebase.google.com/docs/auth) to optionally manage email and customer data

You must also have a Stripe account and a [Stripe API key](https://dashboard.stripe.com/apikeys) before installing this extension.

**Note:** Stripe has a test mode that lets you make API calls without making actual payments. To use this extension with Stripe's test mode, set the extension's `Stripe API key` parameter (during extension configuration) to use a test mode key. A test mode key looks like `rk_test_12345`, whereas a live mode key would be `rk_live_12345`. As this extension only requires write access to your Stripe `customers` and `invoices` resources, we recommend that you create a [restricted key](https://stripe.com/docs/keys#limit-access) with limited access to only these resources rather than using your secret key.

#### Billing

This extension uses the following Firebase services which may have associated charges:

- Cloud Firestore
- Cloud Functions
- Firebase Authentication (optional)

This extension also uses the following third-party services:

- Stripe Billing ([pricing information](https://stripe.com/pricing#billing-pricing))

You are responsible for any costs associated with your use of these services.

##### Note from Firebase

To install this extension, your Firebase project must be on the Blaze (pay-as-you-go) plan. You will only be charged for the resources you use. Most Firebase services offer a free tier for low-volume use. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

Starting August 17 2020, you will be billed a small amount (typically less than \$0.10) when you install or reconfigure this extension. See the [Cloud Functions for Firebase billing FAQ](https://firebase.google.com/support/faq#expandable-15) for a detailed explanation.
