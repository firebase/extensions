### See it in action

You can test out this extension right away!

1.  Go to your [Storage dashboard](https://console.firebase.google.com/project/${param:PROJECT_ID}/storage) in the Firebase console.

1.  Upload an image file to the bucket: `${param:IMG_BUCKET}`

1.  In a few seconds, the resized image(s) appear in the same bucket.

    Note that you might need to refresh the page to see changes.

### Using the extension

You can upload images using the [Cloud Storage for Firebase SDK](https://firebase.google.com/docs/storage/) for your platform (iOS, Android, or Web). Alternatively, you can upload images directly in the Firebase console's Storage dashboard.

Whenever you upload an image file to `${param:IMG_BUCKET}`, this extension does the following:

- Creates resized image(s) with your specified dimensions.
- Names resized image(s) using the same name as the original uploaded image, but suffixed with the specified width and height.
- Stores the resized image(s) in the bucket `${param:IMG_BUCKET}` (and, if configured, under the path `${param:RESIZED_IMAGES_PATH}`).

The extension also copies the following [metadata](https://cloud.google.com/storage/docs/metadata#mutable), if present, from the original image to the resized image(s):

- `Cache-Control`
- `Content-Disposition`
- `Content-Encoding`
- `Content-Language`
- `Content-Type`
- [user-provided metadata](https://cloud.google.com/storage/docs/metadata#custom-metadata)
 - If the original image contains a download token (publicly accessible via a unique download URL), a new download token is generated for the resized image(s). 
 - If the original image does not contain a download token, resized image(s) will not be created with unique tokens. To make a resized image publicly accessible, call the [`getDownloadURL`](https://firebase.google.com/docs/reference/js/firebase.storage.Reference#getdownloadurl) method.

Be aware of the following when using this extension:

- Each original image must have a valid [image MIME type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types#Image_types) specified in its [`Content-Type` metadata](https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Type) (for example, `image/png`). Below is a list of the content types supported by this extension:
  * image/jpeg
  * image/png
  * image/tiff
  * image/webp
  * image/gif

If you are using raw image data in your application, you need to ensure you set the correct content type when uploading to the Firebase Storage bucket to trigger the extension image resize. Below is an example of how to set the content type:

```js
const admin = require("firebase-admin");
const serviceAccount = require("../path-to-service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const storage = admin.storage();

// rawImage param is the binary data read from the file system or downloaded from URL
function uploadImageToStorage(rawImage){
  const bucket = storage.bucket("YOUR FIREBASE STORAGE BUCKET URL");
  const file = bucket.file("filename.jpeg");

  file.save(
    rawImage,
    {
      // set the content type to ensure the extension triggers the image resize(s)
      metadata: { contentType: "image/jpeg" },
    },
    (error) => {
      if (error) {
        throw error;
      }
      console.log("Successfully uploaded image");
    }
  );
}
```

- If you configured the `Cache-Control header for resized images` parameter, your specified value will overwrite the value copied from the original image. Learn more about image metadata in the [Cloud Storage documentation](https://firebase.google.com/docs/storage/).

- If you would like to optionally configure `Output options for selected formats` you can create an JSON stringified object where you can provide file [Sharp Output Options](https://sharp.pixelplumbing.com/api-output#jpeg). Please use file formats as object keys and pass correct options. Incorrect options parameters or not selected formats will be ignored. Provide it as stringified JSON object without outer quote signs and indentation:

```js
{"jpeg": {"quality": 5,"chromaSubsampling": '4:4:4'}, "png": { "pallete": true}}
```

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/extensions/manage-installed-extensions#monitor) of your installed extension, including checks on its health, usage, and logs.

### Further reading & resources

You can find more information about this extension in the following articles:

- [Image Optimization With Firebase Extensions](https://invertase.link/ext-resize-images-tutorial)