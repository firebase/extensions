Use this extension to automatically convert strings to upper case when added to a specified Realtime Database path.

This extension expects a database layout like the following example:

    "messages": {
        MESSAGE_ID: {
            "original": MESSAGE_TEXT
        },
        MESSAGE_ID: {
            "original": MESSAGE_TEXT
        },
    }

When you create new string records, this extension creates a new sibling record with upper-cased
text:

    MESSAGE_ID: {
        "original": MESSAGE_TEXT,
        "upper": UPPERCASE_MESSAGE_TEXT,
    }

#### Additional setup

Before installing this extension, make sure that you've
[set up Realtime Database](https://firebase.google.com/docs/databaae/quickstart)
in your Firebase project.

#### Billing

To install an extension, your project must be on the
[Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- This extension uses other Firebase and Google Cloud Platform services, which have associated
  charges if you exceed the service’s no-cost tier:
  - Realtime Database
  - Cloud Functions (Node.js 10+ runtime)
    [See FAQs](https://firebase.google.com/support/faq#extensions-pricing)
- If you enable events, [Eventarc fees apply](https://cloud.google.com/eventarc/pricing).
