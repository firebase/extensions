Use this extension to send the configuration diff for Firebase Remote Config templates to a Slack webhook URL.

Whenever you modify a Remote Config template in your project, this extension sends the diff between the old and the new configs to your specified Slack webhook URL. Learn more about setting up and configuring templates in the [Remote Config documentation](https://firebase.google.com/docs/remote-config/templates). Note that the first version of your template will not output a diff, but all following updates to the template will show a diff for parameter changes.

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

When you use Firebase Extensions, you're only charged for the underlying resources that you use. Firebase Extensions themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
