To trigger the mod, write URLs to the database path at:
`${param:TRIGGER_PATH}/{urlID}/${param:URL_FIELD_NAME}` via one of the official Firebase SDKs (https://firebase.google.com/docs/database/).
The shortened URL will be written to:
`${param:TRIGGER_PATH}/{urlID}/${param:SHORT_URL_FIELD_NAME}`.

## Sample Realtime Database Structure

This is the database structure based on your given path of: `${param:TRIGGER_PATH}`.

```
/${param:PROJECT_ID}
   /${param:TRIGGER_PATH}
       /url-123456
           ${param:URL_FIELD_NAME}: "https://my.super.long-link.com/api/user/profile/-jEHitne10395-k3593085"
```

When a new URL (string) is pushed to `/${param:TRIGGER_PATH}`, it gets replaced with an object containing the original URL and a shortened one.
This way, you can display a clean URL by fetching `/${param:TRIGGER_PATH}/{urlID}/${param:SHORT_URL_FIELD_NAME}`.

```
/${param:PROJECT_ID}
   /${param:TRIGGER_PATH}
       /url-123456
           ${param:URL_FIELD_NAME}: "https://my.super.long-link.com/api/user/profile/-jEHitne10395-k3593085",
           ${param:SHORT_URL_FIELD_NAME}: "https://bit.ly/EKDdza"
```

## Try it out

To try out this mod right away for the Realtime Database, run the following command via the Firebase CLI:

```
firebase database:push /${param:TRIGGER_PATH} --data '{"${param:URL_FIELD_NAME}": "https://google.com"}'
```
