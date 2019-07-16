Publish messages to the Pub/Sub topic `${param:MOD_INSTANCE_ID}-topic`, then see them appear in your Slack channel!

You can find the topic here: `https://console.cloud.google.com/cloudpubsub/topics/${param:MOD_INSTANCE_ID}-topic?project=${param:PROJECT_ID}`

Then, click **Publish Message** to publish a message to the topic.

You can also publish messages programmatically; learn more in the [Pub/Sub documentation](https://cloud.google.com/pubsub/docs/publisher).
