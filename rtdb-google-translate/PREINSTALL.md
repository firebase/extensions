The Mod will automatically translate messages in the format:
`{"message": "Your message contents go here."}`

created under the path: `YOUR_PATH/languageID`, where languageID is the ISO-639-1 code.
A list of valid languages and their corresponding codes can be found in the
[Cloud Translate official documentation](https://cloud.google.com/translate/docs/languages).

To trigger the mod, write messages to the database path at:
`YOUR_PATH/{languageID}/{messageId}` via one of the [official Firebase SDKs](https://firebase.google.com/docs/database/). The message should be a JSON
resembling the following: `{"message": "Your message goes here."}`.
