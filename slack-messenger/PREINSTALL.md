Use this mod to post messages to your Slack channel using Pub/Sub message queuing.

Whenever a message is published to your specified Pub/Sub topic, this mod takes the contents of the message and forwards it to Slack using the specfied webhook URL.

Using Pub/Sub as the message queue allows this mod to utilize Pub/Sub's performance, queuing capabilities, and retry logic (if desired). This gives the mod more reliability over simply using the Slack webhook and allows the mod to publish messages from anywhere and have one central place that sends them to Slack.

You can also publish messages programmatically; learn more in the [Pub/Sub documentation](https://cloud.google.com/pubsub/docs/publisher).

When you use Firebase Mods, you're only charged for the underlying resources that you use. Firebase Mods themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
