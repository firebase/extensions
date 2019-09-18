# auth-mailchimp-sync

**VERSION**: 0.1.0

**DESCRIPTION**: Adds new users from Firebase Authentication to a specified Mailchimp audience.



**CONFIGURATION PARAMETERS:**

* Deployment location: Where should the extension be deployed? For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Mailchimp API key: What is your Mailchimp API key? To obtain a Mailchimp API key, go to your [Mailchimp account](https://admin.mailchimp.com/account/api/).

* Audience ID: What is the Mailchimp Audience ID to which you want to subscribe new users? To find your Audience ID: visit https://admin.mailchimp.com/lists, click on the desired audience or create a new audience, then select **Settings**. Look for **Audience ID** (for example, `27735fc60a`).

* Contact status: When the extension adds a new user to the Mailchimp audience, what is their initial status? This value can be `subscribed` or `pending`. `subscribed` means the user can receive campaigns; `pending` means the user still needs to opt-in to receive campaigns.



**CLOUD FUNCTIONS CREATED:**

* addUserToList (providers/firebase.auth/eventTypes/user.create)

* removeUserFromList (providers/firebase.auth/eventTypes/user.delete)



**DETAILS**: Use this extension to add new users to an existing [Mailchimp](https://mailchimp.com) audience.

This extension adds the email address of each new user to your specified Mailchimp audience. Also, if the user deletes their user account for your app, this extension removes the user from the Mailchimp audience.

**Note:** To use this extension, you need to manage your users with Firebase Authentication.

This extension uses Mailchimp, so you'll need to supply your Mailchimp API Key and Audience ID when installing this extension.

#### Additional setup

Make sure that you've set up [Firebase Authentication](https://firebase.google.com/docs/auth) to manage your users.

You must also have a Mailchimp account before installing this extension.

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:
- Firebase Realtime Database
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)

Usage of this extension also requires you to have a Mailchimp account. You are responsible for any associated costs with your usage of Mailchimp.
