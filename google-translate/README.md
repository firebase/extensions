# Automatically Generate translations

## Summary

Automatically generate translations for messages saved in the database in a given language. This mod is modified from the functions sample [message-translate](https://github.com/firebase/functions-samples/tree/Node-8/message-translation).

## Details

This Mod defines a Cloud Function that will trigger on write of a message to the database, that translates
the message in the provided language to multiple destination languages.

This Mod uses Cloud Translation. See [official documentation](https://cloud.google.com/translate/docs/languages) for a full list of supported languages.

### Configuration

This Mod requires the following environment variables to be set:

- `LANGUAGES` a comma-separated string of languages, in the ISO-639-1 Code format. For example: English, Portuguese, Korean -> en,pt,kr.


### Required Roles

This Mod requires the following IAM roles:

- `firebase.developAdmin` allows access to the Firebase "develop" products. This mod uses this role to write the signed urls to the Realtime Database.
- `translate.googleapis.com` allows access to the Cloud Translate API.
- `storage.admin` allows full control of buckets and objects. When applied to an individual bucket, control applies only to the specified bucket and objects within that bucket. This role is used to get images from the Cloud Storage bucket and upload the s.

### Resources Created

This Mod creates messages in the database. See USAGE.md for more details.

- a Cloud Function that triggers on write of a message in the database.

### Privacy

This mod stores the environment variables in the source of the Cloud Function.

### Potential Costs

_Disclaimer: without knowing your exact use, it's impossible to say exactly what this may cost._

This mod will generate costs due to:

- **Cloud Functions Usage**: Each time a file is uploaded to the Cloud Storage bucket, a Cloud Function is invoked. If the free quota for Cloud Functions is consumed, then it will generate cost for the Firebase project.
- **Google Translate API Usage**: Each invocation of the Cloud Function also calls the Google Translate API. If the free quota for invoking this API is consumed, then it will generate cost for the Firebase project.

See more details at https://firebase.google.com/pricing.

### Copyright

Copyright 2019 Google LLC

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
