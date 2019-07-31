### See it in action

To test out this mod, follow these steps:

1. Go to the [PubSub tab of Google Cloud Console](https://console.cloud.google.com/cloudpubsub/topics/${param:MOD_INSTANCE_ID}-topic?project=${param:PROJECT_ID}).

1. Click  **Publish Message** to publish a message to the topic. Make sure it is a JSON object with a "text" field. For example:
```
{ "text": "hello world!" }
```

1. In a few seconds, the message will appear in your Slack channel.

### Using the mod

Publish messages to the Pub/Sub topic `${param:MOD_INSTANCE_ID}-topic`, then see them appear in your Slack channel!

You can publish messages using the [Google Cloud Console](https://console.cloud.google.com/cloudpubsub/topics/${param:MOD_INSTANCE_ID}-topic?project=${param:PROJECT_ID}) as detailed above or programmatically; learn more in the [Pub/Sub documentation](https://cloud.google.com/pubsub/docs/publisher).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/mods/manage-installed-mods#monitor) of your installed mod, including checks on its health, usage, and logs.
