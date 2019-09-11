### See it in action

To test out this extension, follow these steps:

1.  Go to the [Storage tab](https://console.firebase.google.com/project/${param:PROJECT_ID}/storage).

1.  Upload an image file to the `${param:IMG_BUCKET}` bucket.

1.  In a few seconds, the resized image will appear in the same bucket. Note that you might need to refresh the page to see it.

### Using the extension

The function `${function:generateResizedImage.name}` located in `${function:generateResizedImage.location}` triggers upon the upload of any image file to `${param:IMG_BUCKET}`. This extension creates a resized image with your specified dimensions. Both the original uploaded image and the resized image are saved in `${param:IMG_BUCKET}`. The resized image file uses the same name as the original uploaded image, but is suffixed with `_${param:IMG_MAX_WIDTH}x${param:IMG_MAX_HEIGHT}` in the filename. 

You can upload images to `${param:IMG_BUCKET}` directly in the Firebase console's Storage dashboard. Alternatively, you can upload images using the [Cloud Storage for Firebase SDK](https://firebase.google.com/docs/storage/) for your platform (iOS, Android, or Web).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
