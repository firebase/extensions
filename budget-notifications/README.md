# budget-notification

**VERSION**: 0.1.0

**DESCRIPTION**: Send notifications to Zapier when your Firebase project exceeds your budget. Optionally, you can also configure your Zapier account to notify you and your team about budget overshooting via preferrred channels. (Requires a Zapier account)



**CONFIGURATION PARAMETERS:**

* Zapier Webhook URL: *i.e. `https://hooks.zapier.com/hooks/catch/XXXXXXX/YYYYYY/`*

* Topic Name: *The Pub/Sub topic you used to enable budget notifications. Please refer to the [Manage notifications](`https://cloud.google.com/billing/docs/how-to/budgets#manage-notifications`) section to configure a Pub/Sub topic if you haven't already.
*

* Email: *Email to send notifications to. This is only required if you plan to send an email in Zapier.
*



**CLOUD FUNCTIONS CREATED:**

* sendBudgetNotifications (google.pubsub.topic.publish)



**APIS USED**:

* cloudbilling.googleapis.com (Reason: Todo)

* pubsub.googleapis.com (Reason: Todo)



**ACCESS REQUIRED**:



This mod will operate with the following project IAM roles:

* firebase.developAdmin (Reason: Todo)
