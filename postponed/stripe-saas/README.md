# stripe-saas

**VERSION**: 0.0.1

**DESCRIPTION**: Manage SaaS subscriptions in your application using Stripe as a payment processor.



**CONFIGURATION PARAMETERS:**

* Stripe Secret Key: *The secret API key for your Stripe account. Can be found at https://dashboard.stripe.com/account/apikeys
*

* Stripe Signing Secret: *Create a new webhook at https://dashboard.stripe.com/account/webhooks. Set the "URL to be called" to http://example.com/ (you will change this later). Next, click on the webhook you just created and reveal the "Signing Secret". This allows the stripe-saas mod to verify incoming webhooks as authentic. Enter the secret here.
*

* Firestore Users Collection: *The Firestore users collection in which subscription information will be embedded. This collection MUST be keyed by uid and MAY be your primary users collection. Only the information in the defined subscription field will be written/overwritten by the stripe-saas mod.
*

* Firestore Billing Field: *Name the document field in the users collection where you want to store information about the Stripe customer and subscription. Enter "." to store information at the top level of the document.
*

* Firestore Subscriptions Collection: *Name a collection in which to store full Stripe API subscription data. This collection must be kept to ensure that duplicate event processing does not take place.
*



**CLOUD FUNCTIONS CREATED:**

* hook (HTTPS)

* subscribe (HTTPS)

* unsubscribe (HTTPS)



**DETAILS**: The `stripe-saas` mod provides a [callable function][callable] that can be used to create Stripe subscriptions.
To utilize it, you must first authenticate a user with Firebase Authentication, then call the
function. You must provide a `plan` and (if the user doesn't already have a default payment
source) a `source` [billing token][source]. An example in JavaScript:

```js
const subscribe = firebase.functions().httpsCallable(SUBSCRIBE_FUNCTION_NAME);
const unsubscribe = firebase
  .functions()
  .httpsCallable(UNSUBSCRIBE_FUNCTION_NAMEE);

// to create a new subscription
const subscription = await subscribe({
  plan: "my_plan",
  source: "tok_thisisanexample", // Stripe card token
});

// for a user with an existing subscription
await unsubscribe();
```



**ACCESS REQUIRED**:



This mod will operate with the following project IAM roles:

* datastore.user (Reason: allows the mod to read from and write to Cloud Firestore.)
