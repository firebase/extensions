Your mod is installed and ready to go!

The function `${FUNCTION_NAME_GENERATERESIZEDIMAGE}` located in `${FUNCTION_LOCATION_GENERATERESIZEDIMAGE}` will trigger on the upload of any file to the Cloud Storage bucket you've chosen: `${IMG_BUCKET}`.

You can upload images to `${IMG_BUCKET}` by going to the Firebase Console Storage tab and following instructions there. After a short while, a resized image with same name but prefixed with `${IMG_PREFIX}` will be created in the same bucket (you may have to refresh to see the new file).

[Signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls) for both the original image and resized image can be found by going to the Firebase Console Database tab and looking under `${SIGNED_URLS_PATH}`. Signed URLs is a mechanism for query string authentication for buckets and objects. Signed URLs provide a way to give time-limited read or write access to anyone in possession of the URL, regardless of whether they have a Google account.

Happy resizing!
