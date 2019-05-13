This Mod contains a single function that is triggered on a PubSub topic. When it receives a message, it takes the contents of the message and forwards it to Slack using the provided webhook URL.

Using PubSub as the message queue allows us to utilize PubSub's performance, queuing capabilities, and retry logic (if desired). This gives us more reliability over simply using the Slack webhook and allows us to publish messages from anywhere and have one central place that sends them to Slack.

Messages can also be published programmatically; see the PubSub documentation for
more information: `https://cloud.google.com/pubsub/docs/publisher`
