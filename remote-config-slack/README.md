# Remote Config Slack

## Summary

This mod defines a Cloud Function that triggers whenever a Firebase RemoteConfig is modified and posts it to the user-provided Slack API webhook.

## Details

This mod listens on changes in RemoteConfig for a single Firebase project. See [Firebase RemoteConfig documentation](https://firebase.google.com/docs/remote-config/).

This mod uses the Slack API, and requires a webhook to send data to. See [Slack Incoming Webhooks documentation](https://api.slack.com/incoming-webhooks).

### Configuration

This Mod requires 1 environment variable:

- `SLACK_WEBHOOK_URL` is the Incoming Webhook URL to which this mod will post RemoteConfig updates.

### Required Roles

This mod requires the growthAdmin role, since RemoteConfig is a Firebase Growth product.

### Resources Created

This Mod does not create any resources.

### Privacy

This mod requires a Slack webhook URL to which to post. It stores it in the source of the Cloud Functions it creates.

### Potential Costs

_Disclaimer: without knowing your exact use, it's impossible to say exactly what this may cost._

This mod will generate costs due to:

- **Cloud Functions Usage**: This Mod makes external network calls (to Slack), therefore it will generate costs for Cloud Functions. See more details at https://firebase.google.com/pricing.
- **Slack Usage**: This Mod sends Slack messages via a webhook - the number of messages that are displayed in Slack and the number of webhooks allowed differ based on the Slack Plan tier. See https://slack.com/plans .

### Copyright

Copyright 2019 Google LLC

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
