Whenever a Firebase Remote Config is modified in your project, the diff between the old configuration and the new configuration will be sent to the provided Slack webhook URL. See [Remote Config documentation](https://firebase.google.com/docs/remote-config/). Note that the first version of your Remote Config will not output a diff, but all following updates to the Remote Config will show parameter changes between the most recent version and the version just prior.

Example Remote Config diff, sent to Slack:

Remote Config changed to version _2_.
Updated by `user@example.com`
from `CONSOLE` as `INCREMENTAL_UPDATE`.
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
