Use this extension to control the maximum number of nodes stored in a Firebase Realtime Database path.

If the number of nodes in your specified Realtime Database path exceeds the specified max count, this extension deletes the oldest nodes first until there are the max count number of nodes remaining.

#### Additional setup

Before installing this extension, make sure that you've [set up a Realtime Database instance](https://firebase.google.com/docs/database) in your Firebase project.

### Billing
 
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)
 
- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s free tier:
  - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#expandable-24))
  - Firebase Realtime Database
