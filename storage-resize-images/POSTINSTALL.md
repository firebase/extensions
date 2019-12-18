storage-resize-images/POSTINSTALL.md
### See it in action

You can test out this extension right away:

1.  Go to your [Storage dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/storage).

1.  Upload an image file to the bucket: `${param:IMG_BUCKET}`

1.  In a few seconds, the resized image(s) appear in the same bucket.

    Note that you might need to refresh the page to see changes.

### Using the extension

You can upload images using the [Cloud Storage for Firebase SDK](https://firebase.google.com/docs/storage/) for your platform (iOS, Android, or Web). Alternatively, you can upload images directly in the Firebase console's Storage dashboard.

When you upload an image file to `${param:IMG_BUCKET}`, this extension:

- Creates resized image(s) with your specfied dimensions.
- Names resized image(s) using the same name as the original uploaded image, but suffixed with the specified width and height.
- Stores the resized image(s) in the bucket `${param:IMG_BUCKET}` (and, if configured, under the path `${param:RESIZED_IMAGES_PATH}`).

The extension also copies the following metadata, if present, from the original image to the resized image(s):

- [`Cache-Control`](https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control)
- [`Content-Disposition`](https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Disposition)
- [`Content-Encoding`](https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Encoding)
- [`Content-Language`](https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Language)
- [`Content-Type`](https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Type)
- [user-provided metadata](https://cloud.google.com/storage/docs/metadata#custom-metadata) (except Firebase storage download tokens)

Note that if you configured the `Cache-Control header for resized images` param, the specified value will overwrite the value copied from the original image. Learn more about image metadata in the [Cloud Storage documentation](https://firebase.google.com/docs/storage/).

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
