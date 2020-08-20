Use this extension to add new users to an existing [Mailchimp](https://mailchimp.com) audience.

This extension adds the email address of each new user to your specified Mailchimp audience. Also, if the user deletes their user account for your app, this extension removes the user from the Mailchimp audience.

**Note:** To use this extension, you need to manage your users with Firebase Authentication.

This extension uses Mailchimp, so you'll need to supply your Mailchimp API Key and Audience ID when installing this extension.

#### Additional setup

Make sure that you've set up [Firebase Authentication](https://firebase.google.com/docs/auth) to manage your users.

You must also have a Mailchimp account before installing this extension.

#### Billing
 
To install an extension, your project must be on the [Blaze (pay as you go) plan](http://firebase.google.com/pricing)
 
- You will be charged around $0.01/month for each instance of this extension you install.
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s free tier:
  - Firebase Realtime Database
  - Firestore
  - Cloud Functions (Node.js 10+ runtime. See FAQs)