# Slack Messenger

## Summary

Sends messages to Slack via a webhook from messages provided in a PubSub topic.

## Details

This Mod contains a single function that is triggered on a PubSub topic. When it receives a message, it takes the contents of the message and forwards it to Slack using the provided webhook URL.

Using PubSub as the message queue allows us to utilize PubSub's performance, queuing capabilities, and retry logic (if desired). This gives us more reliability over simply using the Slack webhook and allows us to publish messages from anywhere and have one central place that sends them to Slack.

### Configuration

This Mod requires the following environment variables to be set:

- `SLACK_WEBHOOK_URL` is the Slack webhook URL used to post into a channel.

### Required Roles

This Mod requires no additional IAM roles.

### Resources Created

This Mod creates one resource:

- a (golang) Cloud Function that is triggered by a PubSub topic.

### Privacy

This mod stores the environment variables in the source of the Cloud Function.

### Potential Costs

_Disclaimer: without knowing your exact use, it's impossible to say exactly what this may cost._

This mod will generate costs due to:

- **Cloud Functions Usage**: Each time a file is uploaded to the Cloud Storage bucket, a Cloud Function is invoked. If the free quota for Cloud Functions is consumed, then it will generate cost for the Firebase project.
- **PubSub Topic Usage**: While this mod does not _send_ messages to PubSub topics, it does receive them. If the free quota for PubSub messaging is reached, it will generate cost for the Firebase project.

See more details at https://firebase.google.com/pricing/ and https://cloud.google.com/pricing/.

### Copyright

Copyright 2018 Google LLC

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
