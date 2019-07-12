/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_SIGNING_SECRET = process.env.STRIPE_SIGNING_SECRET;
const USERS_COLLECTION = process.env.USERS_COLLECTION;
const SUBSCRIPTIONS_COLLECTION = process.env.SUBSCRIPTIONS_COLLECTION;
const BILLING_FIELD = process.env.BILLING_FIELD;

const stripe = require("stripe")(STRIPE_SECRET_KEY);
const admin = require("firebase-admin");
const functions = require("firebase-functions");
admin.initializeApp();

const db = admin.firestore();

const usersRef = db.collection(USERS_COLLECTION);
const subscriptionsRef = db.collection(SUBSCRIPTIONS_COLLECTION);

function annotateError(err, annotation) {
  err.message = `[stripe-saas] ${annotation}: ${err.message}`;
  return err;
}

function timestamp(seconds) {
  return seconds ? new admin.firestore.Timestamp(seconds, 0) : null;
}

function billingUpdate(data) {
  const update = {};
  if (BILLING_FIELD === ".") {
    update = data;
  } else {
    update[BILLING_FIELD] = data;
  }
  return update;
}

function subscriptionSummaryUpdate(subscription) {
  return billingUpdate({
    subscription: {
      id: subscription.id,
      plan_id: subscription.plan.id,
      current_period_start: timestamp(subscription.current_period_start),
      current_period_end: timestamp(subscription.current_period_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: timestamp(subscription.canceled_at),
      status: subscription.status,
    },
  });
}

function verifyWebhook(next) {
  return function(req, res) {
    try {
      stripe.webhooks.constructEvent(
        req.rawBody.toString(),
        req.headers["stripe-signature"],
        STRIPE_SIGNING_SECRET
      );
      next(req, res);
    } catch (err) {
      console.error(annotateError(err, "unable to verify webhook"));
      res.status(400).send("Could not verify request.");
    }
  };
}

async function handleCustomerEvent(event) {
  const customer = event.data.object;
  if (!customer || !customer.id) {
    console.error(
      new Error(
        `[stripe-saas] unexpected payload format, no id found in ${JSON.stringify(
          event.data.object
        )}`
      )
    );
    return;
  }
  if (!customer.metadata || !customer.metadata.uid) {
    console.error(
      new Error(
        `[stripe-saas] customer ${
          customer.id
        } has no uid metadata field, cannot sync`
      )
    );
    return;
  }
  const uid = customer.metadata.uid;
  await usersRef
    .doc(uid)
    .set(billingUpdate({ customer_id: customer.id }), { merge: true });
  console.log("[stripe-saas] set customer id", customer.id, "for user", uid);
  return;
}

async function handleSubscriptionEvent(event) {
  const subscription = event.data.object;
  const customer = await stripe.customers.retrieve(subscription.customer);
  if (!customer.metadata || !customer.metadata.uid) {
    console.error(
      "[stripe-saas] Customer",
      customer.id,
      "has no uid in metadata, unable to sync subscription information."
    );
    return;
  }
  const uid = customer.metadata.uid;

  const subRef = subscriptionsRef.doc(subscription.id);
  const evRef = subRef.collection("stripe_events").doc(event.id);
  await db.runTransaction(async (txn) => {
    const evSnap = await txn.get(evRef);
    if (evSnap.exists) {
      console.log(
        "[stripe-saas] skipping event",
        event.id,
        "was already handled at",
        evSnap.data().handled.toDate()
      );
      return;
    }

    txn.set(usersRef.doc(uid), subscriptionSummaryUpdate(subscription), {
      merge: true,
    });
    txn.set(subRef, Object.assign(subscription, { uid }));
    txn.set(evRef, { handled: admin.firestore.FieldValue.serverTimestamp() });
  });

  console.log("[stripe-saas] updated subscription for", uid);
}

async function handleEvent(event) {
  switch (event.type) {
    case "customer.created":
    case "customer.updated":
      console.log("[stripe-saas] handling", event.type);
      return handleCustomerEvent(event);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      console.log("[stripe-saas] handling", event.type);
      return handleSubscriptionEvent(event);
    default:
      console.log("[stripe-saas] unhandled event type:", event.type);
  }
}

exports.hook = verifyWebhook(async function(req, res) {
  const event = req.body;
  try {
    await handleEvent(event);
    res.status(200).send("OK");
  } catch (e) {
    console.error("Error while handling event:", e);
    res.status(500).send("ERROR");
  }
});

async function findOrCreateCustomer(auth, token) {
  const userSnap = await usersRef.doc(auth.uid).get();
  const billing = BILLING_FIELD ? userSnap.get(BILLING_FIELD) : userSnap.data();
  if (billing && billing.customer_id) {
    if (token) {
      await stripe.customers.createSource(billing.customer_id, {
        source: token,
      });
    }
    return billing.customer_id;
  }

  const email = auth.token && auth.token.email ? auth.token.email : null;
  const description = auth.token && auth.token.name ? auth.token.name : email;

  const customer = await stripe.customers.create({
    description,
    email,
    metadata: { uid: auth.uid },
  });
  await stripe.customers.createSource(customer.id, { source: token });
  return customer.id;
}

exports.subscribe = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be signed in to subscribe."
    );
  }
  if (!data.plan) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Must provide a plan for subscription."
    );
  }

  try {
    const customerId = await findOrCreateCustomer(context.auth, data.token);
    return await stripe.subscriptions.create({
      customer: customerId,
      items: [{ plan: data.plan }],
      trial_from_plan: true,
    });
  } catch (err) {
    if (err.type === "StripeCardError") {
      console.log("[stripe-saas] Card error:", err.message);
      throw new functions.https.HttpsError("invalid-argument", err.message);
    }

    console.error("[stripe-saas] Stripe error:", err);
    throw new functions.https.HttpsError(
      "internal",
      "An unexpected error occurred. Please try again later."
    );
  }
});

exports.unsubscribe = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be signed in to unsubscribe."
    );
  }

  const subSnap = await usersRef.doc(context.auth.uid).get();
  if (!subSnap.exists) {
    console.log(
      "[stripe-saas] unsubscribe: no subscription found for user",
      context.auth.uid
    );
    throw new functions.https.HttpsError(
      "failed-precondition",
      "No subscription information found."
    );
  }
  const billing =
    BILLING_FIELD === "." ? subSnap.data() : subSnap.get(BILLING_FIELD);
  if (!billing || !billing.subscription || !billing.subscription.id) {
    console.log(
      "[stripe-saas] unsubscribe: unable to locate subscription id for user",
      context.auth.uid
    );
    throw new functions.https.HttpsError(
      "failed-precondition",
      "No subscription information found."
    );
  }

  return await stripe.subscriptions.update(billing.subscription.id, {
    cancel_at_period_end: true,
  });
});
