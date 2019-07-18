# mailchimper

**VERSION**: 0.1.0

**DESCRIPTION**: Automatically add new users to a specified Mailchimp email list.



**CONFIGURATION PARAMETERS:**

* Deployment location: *Where should the mod be deployed? For help selecting a location, visit https://firebase.google.com/docs/functions/locations.*

* Mailchimp API key: *What is your Mailchimp API key? To obtain a Mailchimp API key, visit https://admin.mailchimp.com/account/api/.*

* Audience ID: *What is the Mailchimp Audience ID to which you want to subscribe new users? To find your Audience ID: visit https://admin.mailchimp.com/lists, click on the desired list or create a new list, then select **Settings**. Look for **Audience ID** (for example, `27735fc60a`).*



**CLOUD FUNCTIONS CREATED:**

* addUserToList (providers/firebase.auth/eventTypes/user.create)

* removeUserFromList (providers/firebase.auth/eventTypes/user.delete)



**DETAILS**: Use this mod to add new users to an email list.

This mod adds the email addresses of each new user to your specified Mailchimp list. Also, if the user deletes their user account for your app, this mod removes the user from the Mailchimp list.

This mod uses Mailchimp, so you'll need to supply your Mailchimp information as part of this mod's installation.
