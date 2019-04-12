Publish messages to the topic `${param:MOD_INSTANCE_ID}-topic` and see them appear in
your Slack channel!

You can find the topic here (click "Publish Message" to publish a message):
`https://console.cloud.google.com/cloudpubsub/topics/${param:MOD_INSTANCE_ID}-topic?project=${param:PROJECT_ID}`

Messages can also be published programmatically; see the PubSub documentation for
more information: `https://cloud.google.com/pubsub/docs/publisher`
