# Run Subscription Payments with Stripe

**Author**: Stripe (**[https://stripe.com](https://stripe.com)**)

**Description**: Controls access to paid content by syncing your subscriptions with Firebase Authentication.



**Details**: Use this extension to create subscriptions for your users with the [Stripe](https://www.stripe.com/) payments platform and manage access control via Firebase Authentication.

Users can sign-up for your digital goods and paid content with Stripe Checkout and manage their subscriptions with the Stripe customer portal.

This extension syncs customers' subscription status with your Cloud Firestore and adds custom claims using Firebase Authentication for convenient access control in your application.

The design for Stripe Checkout and the customer portal can be customized in your Stripe Dashboard [branding settings](https://dashboard.stripe.com/settings/branding). See this example which is customized to match the Firebase color scheme:

![Stripe Checkout Page](https://storage.googleapis.com/stripe-subscriptions-firebase-screenshots/firebase-stripe-subs-checkout.png)
![Stripe Customer Portal](https://storage.googleapis.com/stripe-subscriptions-firebase-screenshots/firebase-stripe-subs-customer-portal.png)

#### Recommended usage

This extension is meant for the web platform. If you're developing native mobile applications and want to sell digital products or services **within** your app, (e.g. subscriptions, in-game currencies, game levels, access to premium content, or unlocking a full version), you must use the app store's in-app purchase APIs. See [Apple's](https://developer.apple.com/app-store/review/guidelines/#payments) and [Google's](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en&ref_topic=9857752) guidelines for more information.

#### Additional setup

Before installing this extension, set up the following Firebase services in your Firebase project:

- [Cloud Firestore](https://firebase.google.com/docs/firestore) to store customer & subscription details.
- [Firebase Authentication](https://firebase.google.com/docs/auth) to enable different sign-up options for your users.

Then, in the [Stripe Dashboard](https://dashboard.stripe.com):

- Create a new [restricted key](https://stripe.com/docs/keys#limit-access) with write access for the "Customers", "Checkout Sessions" and "Customer portal" resources, and read-only access for the "Subscriptions" resource.

#### Billing

This extension uses the following Firebase services which may have associated charges:

- Cloud Firestore
- Cloud Functions
- Firebase Authentication

This extension also uses the following third-party services:

- Stripe Billing ([pricing information](https://stripe.com/pricing#billing-pricing))

You are responsible for any costs associated with your use of these services.

#### Note from Firebase

To install this extension, your Firebase project must be on the Blaze (pay-as-you-go) plan. You will only be charged for the resources you use. Most Firebase services offer a free tier for low-volume use. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

Starting August 17 2020, you will be billed a small amount (typically less than $0.10) when you install or reconfigure this extension. See the [Cloud Functions for Firebase billing FAQ](https://firebase.google.com/support/faq#expandable-15) for a detailed explanation.



**Configuration Parameters:**

* Cloud Functions deployment location: Where do you want to deploy the functions created for this extension? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Products and pricing plans collection: What is the path to the Cloud Firestore collection where the extension should store Stripe pricing plans?

* Customer details and subscriptions collection: What is the path to the Cloud Firestore collection where the extension should store Stripe customer details?

* Stripe API key with restricted access: What is your Stripe API key?  We recommend creating a new [restricted key](https://stripe.com/docs/keys#limit-access) with write access only for the "Customers", "Checkout Sessions" and "Customer portal" resources. And read-only access for the "Subscriptions" resource.

* Stripe webhook secret: This is your signing secret for a Stripe-registered webhook.  This webhook can only be registered after installation. Leave this value untouched during installation, then follow the  postinstall instructions for registering your webhook and configuring this value.



**Cloud Functions:**

* **createCustomer:** Creates a Stripe customer object when a new user signs up.

* **createCheckoutSession:** Creates a Checkout session to collect the customer's payment details.

* **createPortalLink:** Creates links to the customer portal for the user to manage their payment & subscription details.

* **handleWebhookEvents:** Handles Stripe webhook events to keep subscription statuses in sync and update custom claims.

* **clearStripeData:** Deletes the Stripe customer object and cancels all their subscriptions when the user is deleted in Firebase Authentication.



**Access Required**:



This extension will operate with the following project IAM roles:

* firebaseauth.admin (Reason: Allows the extension to set custom claims for users.)

* datastore.user (Reason: Allows the extension to store customers & subscriptions in Cloud Firestore.)
