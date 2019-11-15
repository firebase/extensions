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

The extension also copies over to the resized image(s) the following [metadata](https://cloud.google.com/storage/docs/json_api/v1/objects/insert#request_properties_JSON) associated with the original image:

- content disposition
- content encoding
- content language
- content type
- user-provided metadata (except Firebase storage download tokens)
- Cache-Control header

Note that if you configured the `Cache-Control header for resized images` param, the specified value will overwrite the value copied over with the original image.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
