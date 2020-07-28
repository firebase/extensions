### Configuring the extension

#### Set your Cloud Firestore security rules

It is crucial to limit data access to authenticated users only and for users to only be able to see their own information. For product and pricing information it is important to disable write access for client applications. Use the rules below to restrict access as recommended in your project's [Cloud Firestore rules](https://console.firebase.google.com/project/_/database/firestore/rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /${param:CUSTOMERS_COLLECTION}/{uid} {
      allow read, write: if request.auth.uid == uid;

      match /checkout_sessions/{id} {
        allow read, write: if request.auth.uid == uid;
      }
      match /subscriptions/{id} {
        allow read, write: if request.auth.uid == uid;
      }
    }

    match /${param:PRODUCTS_COLLECTION}/{id} {
      allow read: if true;
      allow write: if false;

      match /prices/{id} {
        allow read: if true;
        allow write: if false;
      }
    }
  }
}
```

#### Configure Stripe webhooks

You need to set up a webhook that synchronizes relevant details from Stripe with your Cloud Firestore. This includes product and pricing data from the Stripe Dashboard, as well as customer's subscription details.

Here's how to set up the webhook and configure your extension to use it:

1. Configure your webhook:

   1. Go to the [Stripe dashboard.](https://dashboard.stripe.com/webhooks)

   1. Use the URL of your extension's function as the endpoint URL. Here's your function's URL: `${function:handleWebhookEvents.url}`

   1. Select the following events:

   - `product.created`
   - `product.updated`
   - `price.created`
   - `price.updated`
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

1. Using the Firebase console or Firebase CLI, [reconfigure](https://console.firebase.google.com/project/${param:PROJECT_ID}/extensions/instances/${param:EXT_INSTANCE_ID}?tab=config) your extension with your webhook’s signing secret (such as, `whsec_12345678`). Enter the value in the parameter called `Stripe webhook secret`.

#### Create product and pricing information

For Stripe to automatically bill your users for recurring payments, you need to create your product and pricing information in the [Stripe Dashboard](https://dashboard.stripe.com/test/products). When you create or update your product and price information in the Stripe Dashboard these details are automatically synced with your Cloud Firestore, as long as the webhook is configured correctly as described above.

The extension currently supports pricing plans that bill a predefined amount at a specific interval. More complex plans (e.g. different pricing tiers or seats) are not yet supported. If you'd like to see support for these, please open a [feature request issue](https://github.com/stripe/stripe-firebase-extensions/issues/new/choose) with details about your business model and pricing plans.

For example, this extension works well for business models with different access level tiers, e.g.:

- Product 1: Basic membership
  - Price 1: 10 USD per month
  - Price 2: 100 USD per year
  - Price 3: 8 GBP per month
  - Price 4: 80 GBP per year
  - [...]: additional currency and interval combinations
- Product 2: Premium membership
  - Price 1: 20 USD per month
  - Price 2: 20 USD per year
  - Price 3: 16 GBP per month
  - Price 4: 160 GBP per year
  - [...]: additional currency and interval combinations

#### Assign custom claim roles to products

If you want users to get assigned a [custom claim role](https://firebase.google.com/docs/auth/admin/custom-claims) to give them access to certain data when subscribed to a specific product, you can set a `firebaseRole` metadata value on the Stripe product ([see screenshot](https://www.gstatic.com/mobilesdk/200710_mobilesdk/ext_stripe_subscription_post_install.png)).

The value you set for `firebaseRole` (e.g. "premium" in the screenshot above) will be set as a custom claim `stripeRole` on the user. This allows you to [set specific security access rules](https://firebase.googleblog.com/2019/03/firebase-security-rules-admin-sdk-tips.html) based on the user's roles, or [limit access to certain pages](https://firebase.google.com/docs/auth/admin/custom-claims#access_custom_claims_on_the_client). For example if you have one `basic` role and one `premium` role you could add the following to your Cloud Firestore rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function hasBasicSubs() {
      return request.auth.token.stripeRole == "basic";
    }

    function hasPremiumSubs() {
      return request.auth.token.stripeRole == "premium";
    }

    match /content-basic/{doc} {
      allow read: if hasBasicSubs() || hasPremiumSubs();
    }
    match /content-premium/{doc} {
      allow read: if hasPremiumSubs();
    }
  }
}
```

Alternatively you can validate their role client-side with the JavaScript SDK. When doing so you need to make sure to force-refresh the user token:

```js
async function getCustomClaimRole() {
  await firebase.auth().currentUser.getIdToken(true);
  const decodedToken = await firebase.auth().currentUser.getIdTokenResult();
  return decodedToken.claims.stripeRole;
}
```

#### Configure the Stripe customer portal

1. Set your custom branding in the [settings](https://dashboard.stripe.com/settings/branding).
1. Configure the Customer Portal [settings](https://dashboard.stripe.com/test/settings/billing/portal).
1. Toggle on "Allow customers to update their payment methods".
1. Toggle on "Allow customers to update subscriptions".
1. Toggle on "Allow customers to cancel subscriptions".
1. Add the products and prices that you want to allow customer to switch between.
1. Set up the required business information and links.

### Using the extension

Once you've configured the extension you can add subscription payments and access control to your websites fully client-side with the [Firebase JavaScript SDK](https://firebase.google.com/docs/web/setup). You can experience a demo application at [https://stripe-subs-ext.web.app](https://stripe-subs-ext.web.app/) and find the demo source code on [GitHub](https://github.com/stripe-samples/firebase-subscription-payments);

#### Sign-up users with Firebase Authentication

The quickest way to sign-up new users is by using the [FirebaseUI library](https://firebase.google.com/docs/auth/web/firebaseui). Follow the steps outlined in the official docs. The extension listens to new users signing up and then automatically creates a Stripe customer object and a customer record in your Cloud Firestore.

#### List available products and prices

Products and pricing information are normal collections and docs in your Cloud Firestore and can be queried as such:

```js
db.collection('${param:PRODUCTS_COLLECTION}')
  .where('active', '==', true)
  .get()
  .then(function (querySnapshot) {
    querySnapshot.forEach(async function (doc) {
      console.log(doc.id, ' => ', doc.data());
      const priceSnap = await doc.ref.collection('prices').get();
      priceSnap.docs.forEach((doc) => {
        console.log(doc.id, ' => ', doc.data());
      });
    });
  });
```

#### Start a subscription with Stripe Checkout

To subscribe the user to a specific pricing plan, create a new doc in the `checkout_sessions` collection for the user. The extension will update the doc with a Stripe Checkout session ID which you then use to redirect the user to the checkout page.

To redirect to Stripe Checkout from your web client, you will need to load Stripe.js. See the [Stripe docs](https://stripe.com/docs/payments/checkout/set-up-a-subscription#redirect-checkout) for more information.

```js
const docRef = await db
  .collection('${param:CUSTOMERS_COLLECTION}')
  .doc(currentUser.uid)
  .collection('checkout_sessions')
  .add({
    price: formData.get('price'),
    success_url: window.location.origin,
    cancel_url: window.location.origin,
  });
// Wait for the CheckoutSession to get attached by the extension
docRef.onSnapshot((snap) => {
  const { sessionId } = snap.data();
  if (sessionId) {
    // We have a session, let's redirect to Checkout
    // Init Stripe
    const stripe = Stripe('pk_test_1234');
    stripe.redirectToCheckout({ sessionId });
  }
});
```

#### Get the customer's subscription

Subscription details are synced to the `subscriptions` sub-collection in the user's corresponding customer doc.

```js
db.collection('${param:CUSTOMERS_COLLECTION}')
  .doc(currentUser.uid)
  .collection('subscriptions')
  .where('status', '==', 'active')
  .onSnapshot(async (snapshot) => {
    // In this implementation we only expect one active Subscription to exist
    const doc = snapshot.docs[0].data();
    console.log(doc.id, ' => ', doc.data());
  });
```

#### Redirect to the customer portal

Once a customer is subscribed you should show them a button to access the customer portal to view their invoices and manage their payment & subscription details. When the user clicks that button, call the `createPortalLink` function to get a portal link for them, then redirect them.

```js
const functionRef = firebase
  .app()
  .functions('${param:LOCATION}')
  .httpsCallable('${function:createPortalLink.name}');
const { data } = await functionRef({ returnUrl: window.location.origin });
window.location.assign(data.url);
```

#### Delete User Data

When a user is deleted in Firebase Authentication the extension will delete their customer object in Stripe which will immediately cancel all subscriptions for the user. 

The extension will not delete any data from the Cloud Firestore. Should you wish to the customer data from Cloud Firestore, you can use the [Delete User Data](https://firebase.google.com/products/extensions/delete-user-data) extension built by the Firebase team.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.

Access the [Stripe dashboard](https://dashboard.stripe.com/) to manage all aspects of your Stripe account.

Enjoy and please submit any feedback and feature requests on [GitHub](https://github.com/stripe/stripe-firebase-extensions/issues/new/choose)!
