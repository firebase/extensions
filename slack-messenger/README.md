# slack-messenger

**VERSION**: 1.0.0

**DESCRIPTION**: Sends messages published to a Pub/Sub topic to a specified Slack channel.



**CONFIGURATION PARAMETERS:**

* Deployment location: *Where should the mod be deployed? For help selecting a location, visit https://firebase.google.com/docs/functions/locations.*

* Slack webhook URL: *What is the webhook URL provided by Slack for posting into a channel?
Here's an example webhook URL: https://hooks.slack.com/services/FOO/BAR/KEY
Learn more about webhooks and Slack: https://api.slack.com/incoming-webhooks*



**CLOUD FUNCTIONS CREATED:**

* slackMessenger (providers/cloud.pubsub/eventTypes/topic.publish)



**NON-CLOUD FUNCTION RESOURCES CREATED**:

* SlackMessengerTopic (gcp-types/pubsub-v1:projects.topics)



**DETAILS**: Use this mod to post messages to your Slack channel using Pub/Sub message queuing.

Whenever a message is published to your specified Pub/Sub topic, this mod takes the contents of the message and forwards it to Slack using the specfied webhook URL.

Using Pub/Sub as the message queue allows this mod to utilize Pub/Sub's performance, queuing capabilities, and retry logic (if desired). This gives the mod more reliability over simply using the Slack webhook and allows the mod to publish messages from anywhere and have one central place that sends them to Slack.

You can also publish messages programmatically; learn more in the [Pub/Sub documentation](https://cloud.google.com/pubsub/docs/publisher).
