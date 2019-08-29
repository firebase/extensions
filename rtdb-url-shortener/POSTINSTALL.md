### See it in action

To test out this extension, run the following command using the Firebase CLI:

```
firebase database:push /${param:TRIGGER_PATH} --data '{"${param:URL_FIELD_NAME}": "https://google.com"}'
```

When you go to the [Realtime Database tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/database/${param:PROJECT_ID}/data), you'll see your database populated with both the original URL and the shortened URL, with a data structure like so:

```
/${param:PROJECT_ID}
   /${param:TRIGGER_PATH}
       /<urlId>
           ${param:URL_FIELD_NAME}: "https://google.com",
           ${param:SHORT_URL_FIELD_NAME}: "<shortened-URL>"
```

### Use this extension

To trigger this extension, write URLs to the database path: `${param:TRIGGER_PATH}/{urlID}/${param:URL_FIELD_NAME}`. You can use any of the [Firebase Realtime Database SDKs](https://firebase.google.com/docs/database/). When triggered, the extension writes the shortened URL to the database path: `${param:TRIGGER_PATH}/{urlID}/${param:SHORT_URL_FIELD_NAME}`.

If the original URL in the database path is updated, then the shortened URL will be automatically updated, too.

You can display a shortened URL by fetching `/${param:TRIGGER_PATH}/{urlID}/${param:SHORT_URL_FIELD_NAME}`.


### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
