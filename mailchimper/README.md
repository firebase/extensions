# Add Users to Mailchimp List

## Summary

When a new Firebase Authentication user is added to the Firebase project where this mod is installed, their email address will be added to a Mailchimp list that the mod consumer specifies when installing this mod. When that user is deleted, their email address will also be deleted from the Mailchimp list.

## Details

This mod uses the Mailchimp API, and requires a [Mailchimp account](https://login.mailchimp.com/signup/). It also requires that users of the app are managed through [Firebase Authentication](https://firebase.google.com/docs/auth/). This mod only adds new users to the Mailchimp list. It does not do a bulk import of existing users.

### Configuration

This Mod requires 2 variables to correctly run:

- `MAILCHIMP_KEY` is the API key for the Mailchimp account.
- `LIST_ID` is the ID associated with the Mailchimp list to add new users to. It is an auto-generated string of letters and numbers, and is different from the human-readable name of the list. It is available on the settings page for a Mailchimp list.

### Required Roles

Since this Mod only interacts with the Mailchimp API, and not any other Google products. It does not require any IAM roles.

### Resources Created

This Mod creates two resources:

- a Cloud Function that triggers for every new user, which makes a call to the Mailchimp API to add the user to the configured list.
- a Cloud Function that triggers for every deleted user, which makes a call to the Mailchimp API to remove the user from the configured list.

### Privacy

This mod requires the API key for the mod consumer's Mailchimp account. It stores it in the source of the Cloud Functions it creates.

### Potential Costs

_Disclaimer: without knowing your exact use, it's impossible to say exactly what this may cost._

This mod will generate costs due to:

- **Cloud Functions Usage**: This Mod makes external network calls (to Mailchimp), therefore it will generate costs for Cloud Functions. See more details at https://firebase.google.com/pricing.
- **Mailchimp Usage**: If there are a lot of new users, and the subscriber count for Mailchimp goes over the free quota, then you will have to upgrade to a paid plan. See https://mailchimp.com/pricing for more details.

### Copyright

Copyright 2018 Google LLC

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
