# Add new users to Mailchimp

**Description**: Automatically add new users to a specified Mailchimp email list.



**Details**: Use this mod to add new users to an email list.

This mod adds the email addresses of each new user to your specified Mailchimp list. Also, if the user deletes their user account for your app, this mod removes the user from the Mailchimp list.

This mod uses Mailchimp, so you'll need to supply your Mailchimp information as part of this mod's installation.

When you use Firebase Mods, you're only charged for the underlying resources that you use. Firebase Mods themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)




**Configuration Parameters:**

* Deployment location: Where should the mod be deployed? For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Mailchimp API key: What is your Mailchimp API key? To obtain a Mailchimp API key, go to your [Mailchimp account](https://admin.mailchimp.com/account/api/).

* Audience ID: What is the Mailchimp Audience ID to which you want to subscribe new users? To find your Audience id: visit https://admin.mailchimp.com/lists, click on the desired audience or create a new audience, then select **Settings**. Look for **Audience ID** (for example, `27735fc60a`).



**Cloud Functions:**

* **addUserToList:** Listens for new user accounts (as managed by Firebase Authentication), then automatically adds the new user to your specified MailChimp email audience.

* **removeUserFromList:** Listens for existing user accounts to be deleted (as managed by Firebase Authentication), then automatically removes them from your specified MailChimp email audience.
