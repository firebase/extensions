# Automatically Resize Images

## Summary

Automatically generate resized images for images that are uploaded to Firebase Storage. This mod is modified from the functions sample [generate-thumbnail](https://github.com/firebase/functions-samples/tree/Node-8/generate-thumbnail).

## Details

This Mod defines a Cloud Function that will trigger on upload of any file to a Cloud Storage bucket. If the file is not an image, then the Cloud Function will simply return. Otherwise, it will go through the flow detailed below.

The image resizing is performed using ImageMagick which is installed by default on all Cloud Functions instances. This is a CLI so we execute the command from node using the [child-process-promise](https://www.npmjs.com/package/child-process-promise) package. The image is first downloaded locally from the Firebase Storage bucket to the `tmp` folder using the [google-cloud](https://github.com/GoogleCloudPlatform/google-cloud-node) SDK.

### Configuration

This Mod requires the following environment variables to be set:

- `IMG_MAX_HEIGHT` is the maximum height for the image in pixels. The default is 200 pixels.
- `IMG_MAX_WIDTH` is the maximum width for the image in pixels. The default is 200 pixels.
- `IMG_PREFIX` is the prefix that will be prepended to the name of the original image. The prefix plus the name of the original image will be used as the name of the thumbnail image. The default is "thumb".
- `THUMB_BUCKET` is the name of the Cloud Storage bucket that the Cloud Function will listen to. The Cloud Function will only trigger and create thumbnail images of the images that are uploaded to this bucket. The default is the default bucket for your project.
- `SIGNED_URLS_PATH` is the path to the node in the Firebase Realtime Database under which [signed urls](https://cloud.google.com/storage/docs/access-control/signed-urls) for the original image and the thumbnailed image will be uploaded. Signed URLs is a mechanism for query string authentication for buckets and objects. Signed URLs provide a way to give time-limited read or write access to anyone in possession of the URL, regardless of whether they have a Google account. The default path is "images".

### Required Roles

This Mod requires the following IAM roles:

- `firebase.developAdmin` allows access to the Firebase "develop" products. This mod uses this role to write the signed urls to the Realtime Database.
- `iam.serviceAccountTokenCreator` allows this mod sign a blob using the service account's system-managed private key. This is used to create the signed urls.
- `storage.admin` allows full control of buckets and objects. When applied to an individual bucket, control applies only to the specified bucket and objects within that bucket. This role is used to get images from the Cloud Storage bucket and upload the thumbnails.

### Resources Created

This Mod creates one resource:

- a Cloud Function that triggers on upload of any file to a Cloud Storage bucket.

### Privacy

This mod stores the environment variables in the source of the Cloud Function.

### Potential Costs

_Disclaimer: without knowing your exact use, it's impossible to say exactly what this may cost._

This mod will generate costs due to:

- **Cloud Functions Usage**: Each time a file is uploaded to the Cloud Storage bucket, a Cloud Function is invoked. If the free quota for Cloud Functions is consumed, then it will generate cost for the Firebase project.
- **Realtime Database Usage**: Each invocation of the Cloud Function also writes to the Realtime Database. If the free quota for storing data in the Realtime Database is consumed, then it will generate cost for the Firebase project.

See more details at https://firebase.google.com/pricing.

### Copyright

Copyright 2018 Google LLC

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
