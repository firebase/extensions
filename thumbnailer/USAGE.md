Your mod is installed and ready to go!

The function `${FUNCTION_NAME_GENERATETHUMBNAIL}` located in `\${FUNCTION_LOCATION_GENERATETHUMBNAIL}` will trigger on the upload of any file to the Cloud Storage bucket you've chosen: `\${THUMB_BUCKET}`.

You can upload images to `\${THUMB_BUCKET}` by going to the Firebase Console Storage tab and following instructions there. After a short while, a thumbnail image with same name but prefixed with `\${THUMB_PREFIX}` will be created in the same folder (you may have to refresh to see the new file).

[Signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls) for both the original image and thumbnail can be found by going to the Firebase Console Database tab and looking under `\${SIGNED_URLS_FOLDER}`.

Happy thumbnailing!
