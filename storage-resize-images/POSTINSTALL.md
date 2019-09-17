### See it in action

You can test out this extension right away:

1.  Go to your [Storage dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/storage).

1.  Upload an image file to the bucket: `${param:IMG_BUCKET}`

1.  In a few seconds, the resized image(s) appear in the same bucket. Note that you might need to refresh the page to see changes.

### Using the extension

When you upload an image file to `${param:IMG_BUCKET}`, this extension:
- Creates resized image(s) with your specfied dimensions
- Stores both the resized image(s) and the original image in the same bucket, `${param:IMG_BUCKET}`
- Names resized image(s) using the same name as the original uploaded image, but suffixed with the specified width and height

You can upload images using the [Cloud Storage for Firebase SDK](https://firebase.google.com/docs/storage/) for your platform (iOS, Android, or Web). Alternatively, you can upload images directly in the Firebase console's Storage dashboard.

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.
