# Budget Notifications Mod

### Requirements

To ensure notifications are sent to Zapier, you need a Budget configured
for your project. Refer to [these steps](https://cloud.google.com/billing/docs/how-to/budgets#manage-notifications) and verify you have:
⋅ Connected Pub/Sub topic `${param:MOD_INSTANCE_ID}-topic` to the budget
⋅ Set Alert Threshold Rules in the budget

### How it works

Installing the mod assumes you have a configured budget connected to the topic specified (`${param:MOD_INSTANCE_ID}-topic`). Your budget sends notifications every ~30 min and publishes the message to the topic. The mod triggers on each publish and checks if the `costAmount` exceeds the `budgetAmount`, then relays the message to Zapier. If the `costAmount` is less than the `budgetAmount`, nothing executes and logs that no action is necessary. Refer to [budget notification format](https://cloud.google.com/billing/docs/how-to/budgets#notification_format) for more info.

### Zapier

Refer to [Zapier](https://zapier.com/developer/documentation/v2/) for usage and integrations. Zapier can be used to create a Slack bot, send messages to Trello, or text.

### Troubleshooting

If you are not receiving notifications and your Zap is properly setup, your budget most likely is not connected
to the correct Pub/Sub topic. The mod will check if the topic exists, but cannot verify if your budget is
connected to it. Alternatively, if the topic doesn't exist, it will create a new topic that the mod will
subscribe to, but you will still have to go into GCP Billing to connect the budget to that topic that was just
created.
