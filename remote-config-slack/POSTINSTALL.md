Whenever you modify a Remote Config template in your project, this extension sends the diff between the old and the new configs to `${param:SLACK_WEBHOOK_URL}`. Learn more about setting up and configuring templates in the [Remote Config documentation](https://firebase.google.com/docs/remote-config/templates). Note that the first version of your experiment will not output a diff, but all following updates to the experiment will show a diff for parameter changes.

### Try out your extension's configuration

Give this extension a try by adding, modifying, or deleting a Remote Config parameter in the [Firebase console](https://console.firebase.google.com/project/_/config), then clicking **Publish changes**.

Here's an example Remote Config diff, sent to Slack:

Remote Config template changed to version _2_.<br>
Updated by `user@example.com`<br>
from `CONSOLE` as `INCREMENTAL_UPDATE`.<br>

_Added 1 parameter:_

```{
   "name": "growth_modal",
   "param": {
      "defaultValue": {
         "value": "a"
      },
      "conditionalValues": {
         "alternate_growth_modal": {
            "value": "b"
         }
      },
      "description": "display a modal to drive user conversion"
   }
}
```

_Removed 1 parameter:_

```{
   "name": "holiday_promo_enabled",
   "param": {
      "defaultValue": {
         "value": "false"
      }
   }
}
```

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
