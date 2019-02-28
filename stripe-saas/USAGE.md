Now that the `stripe-saas` mod has been installed, you will need to update your Stripe webhook
to point to this URL:

    https://${FUNCTION_LOCATION_HOOK}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME_HOOK}

**Important:** For the `stripe-saas` mod to work, all of your Stripe customers MUST have a
`uid` field in their `metadata` that corresponds to their Firebase Authentication uid. This
metadata field is how the mod is able to sync data appropriately for each user.

Customers created via the provided `subscribe` and `unsubscribe` functions will automatically
have metadata populated correctly. If creating users manually or via other code, make sure to
set it. For example, in Node.js:

```js
const customer = await stripe.customers.create({
  email: 'customer@example.com',
  description: 'Your Customer',
  metadata: {uid: '<uid_goes_here>'}
});
```

### Creating Subscriptions

The `stripe-saas` mod provides a [callable function][callable] that can be used to create subscriptions.
To utilize it, you must first authenticate a user with Firebase Authentication, then call the
function. You must provide a `plan` and (if the user doesn't already have a default payment
source) a `source` [billing token][source]. An example in JavaScript:

```js
const subscribe = firebase.functions().httpsCallable('${FUNCTION_NAME_SUBSCRIBE}');
const unsubscribe = firebase.functions().httpsCallable('${FUNCTION_NAME_UNSUBSCRIBE}');

// to create a new subscription
const subscription = await subscribe({
  plan: 'my_plan',
  source: 'tok_thisisanexample' // Stripe card token
});

// for a user with an existing subscription
await unsubscribe();
```

### Stripe SaaS + Cloud Firestore

The `stripe-saas` mod will automatically synchronize subscription information from Stripe
into your Cloud Firestore database in two places:

1. The `${USERS_COLLECTION}` collection, in a field called `${BILLING_FIELD}` (note: a `.`
   field indicates that subscription data will be stored at the top level of the document and
   not embedded). The subscription field will contain the following data:

   * `customer_id`: The Stripe customer id for the user.
   * `subscription`: an object containing the following subscription information:
     * `id`: The Stripe subscription id.
     * `plan_id`: The Stripe payment plan id for the subscription.
     * `status`: The [subscription state][states], for example `active` or `past_due`.
     * `current_period_end`: A Timestamp indicating when the current billing period will end.
     * `current_period_start`: A Timestamp indicating when the current billing period began.
     * `cancel_at_period_end`: True if the subscription will be canceled at the end of the current period.
     * `canceled_at`: A Timestamp indicating when the subscription was canceled.

2. The `${SUBSCRIPTIONS_COLLECTION}` collection, which contains the  full [Stripe API payloads][sub]
   for each subscription. In addition, a `stripe_events` subcollection is created on each subscription
   to [avoid duplicate processing][idempotency].

### Leveraging Subscription Information

The `stripe-saas` mod makes it straightforward to use [Cloud Firestore security rules][rules] to protect
user data based on subscription plan. For instance, to restrict access to parts of a database to
active subscriptions, you could write a function like this:

```
function subscription(uid) {
  return get(/databases/$(database)/documents/${USERS_COLLECTION}/$(request.auth.uid)).data.${BILLING_FIELD}.subscription
}

function hasSubscription(plan_id) {
  return request.auth.uid != null &&
    subscription(request.auth.uid).plan_id == plan_id &&
    subscription(request.auth.uid).status in ['active','trialing']
}

match /subscription_only/{id} {
  allow read: if hasSubscription('my_plan')
}
```

[callable]: https://firebase.google.com/docs/functions/callable
[source]: https://stripe.com/docs/quickstart#collecting-payment-information
[states]: https://stripe.com/docs/billing/lifecycle#subscription-states
[sub]: https://stripe.com/docs/api/subscriptions/object
[idempotency]: https://stripe.com/docs/webhooks#best-practices
[rules]: https://firebase.google.com/docs/firestore/security/get-started
