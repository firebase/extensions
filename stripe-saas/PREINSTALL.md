The `stripe-saas` mod provides a [callable function][callable] that can be used to create Stripe subscriptions.
To utilize it, you must first authenticate a user with Firebase Authentication, then call the
function. You must provide a `plan` and (if the user doesn't already have a default payment
source) a `source` [billing token][source]. An example in JavaScript:

```js
const subscribe = firebase
  .functions()
  .httpsCallable("${function:subscribe.name}");
const unsubscribe = firebase
  .functions()
  .httpsCallable("${function:unsubscribe.name}");

// to create a new subscription
const subscription = await subscribe({
  plan: "my_plan",
  source: "tok_thisisanexample", // Stripe card token
});

// for a user with an existing subscription
await unsubscribe();
```
