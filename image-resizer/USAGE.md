Your mod is installed and ready to go!

The function `${function:generateResizedImage.name}` located in `${function:generateResizedImage.location}` will trigger on the upload of any file to the Cloud Storage bucket you've chosen: `${param:IMG_BUCKET}`.

You can upload images to `${param:IMG_BUCKET}` by going to the Firebase Console Storage tab and following instructions there. Alternatively, you may use the [Cloud Storage for Firebase](https://firebase.google.com/docs/storage/) SDKs available in iOS, Android, and Web to upload images to `${param:IMG_BUCKET}`. After a short while, a resized image with same name but prefixed with `${param:IMG_PREFIX}` will be created in the same bucket (you may have to refresh to see the new file).

[Signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls) for both the original image and resized image can be found by going to the Firebase Console Database tab and looking under `${param:SIGNED_URLS_PATH}`. Signed URLs is a mechanism for query string authentication for buckets and objects. Signed URLs provide a way to give time-limited read or write access to anyone in possession of the URL, regardless of whether they have a Google account. How to use the signed URLs is up to you. One example use case could be for a webpage that displays all members of a club. A listener could be attached to the database so when a new resized image is created, both the original and the resized image are fetched immediately and displayed on the webpage.

Happy resizing!
