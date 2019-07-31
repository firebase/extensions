### See it in action

To test out this mod, follow these steps:

1.  Go to the [Storage tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/storage).

1.  Upload an image file to the `${param:IMG_BUCKET}` bucket.

1.  In a few seconds, the resized image will appear in the same bucket. Note that you might need to refresh the page to see it.

### Using the mod

The function `${function:generateResizedImage.name}` located in `${function:generateResizedImage.location}` triggers upon the upload of any image file to `${param:IMG_BUCKET}`. This mod creates a resized image with your specified dimensions. Both the original uploaded image and the resized image are saved in `${param:IMG_BUCKET}`. The resized image file uses the same name as the original uploaded image, but is suffixed with `_${param:IMG_MAX_WIDTH}x${param:IMG_MAX_HEIGHT}` in the filename. 

You can upload images to `${param:IMG_BUCKET}` directly in the Firebase console's Storage dashboard. Alternatively, you can upload images using the [Cloud Storage for Firebase SDK](https://firebase.google.com/docs/storage/) for your platform (iOS, Android, or Web).

If configured, this mod also optionally creates then writes [signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls) to the Realtime Database path `${param:SIGNED_URLS_PATH}` - both for the original image and the resized image. Signed URLs are a mechanism for query string authentication for buckets and objects by providing a way to give time-limited read or write access to anyone in possession of the URL, regardless of whether they have a Google account. How to use the signed URLs is up to you. One example use case could be for a webpage that displays all members of a club. You could attach a listener to the database path so that when the mod creates a new resized image, both the original and the resized image are fetched immediately and displayed on the webpage.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/mods/manage-installed-mods#monitor) of your installed mod, including checks on its health, usage, and logs.
