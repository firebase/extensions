Use this extension to create resized versions of an image uploaded to a Cloud Storage bucket.

When you upload a file to your specified Cloud Storage bucket, this extension:

- Detects if the file is an image. If it is, then:
  - Creates a resized image with your specified dimensions.
  - Names the resized image using the same name as the original uploaded image, but suffixed with your specified width and height.
  - Stores the resized image in the same Storage bucket as the original uploaded image.

You can even configure the extension to create resized images of different dimensions for each original image upload. For example, you might want images that are 200x200, 400x400, and 680x680 - this extension can create these three resized images then store them in your bucket.

The extension automatically copies the following metadata, if present, from the original image to the resized image(s): `Cache-Control`, `Content-Disposition`, `Content-Encoding`, `Content-Language`, `Content-Type`, and user-provided metadata (a new Firebase storage download token will be generated on the resized image(s) if the original metadata contains a token). Note that you can optionally configure the extension to overwrite the [`Cache-Control`](https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control) value for the resized image(s).

The extension supports resizing images in `JPEG`, `PNG`, `WebP`, `GIF`, `AVIF` and `TIFF` formats, and the output can be in one or more of these formats.

The extension can publish a resize completion event which you can optionally enable when you install the extension. If you enable events, you can [write custom event handlers](https://firebase.google.com/docs/extensions/install-extensions#eventarc) that respond to these events. You can always enable or disable events later. Events will be emitted via Eventarc.

#### Detailed configuration information

To configure this extension, you specify a maximum width and a maximum height (in pixels, px). This extension keeps the aspect ratio of uploaded images constant and shrinks the image until the resized image's dimensions are at or under your specified max width and height.

For example, say that you specify a max width of 200px and a max height of 100px. You upload an image that is 480px wide by 640px high, which means a 0.75 aspect ratio. The final resized image will be 75px wide by 100px high to maintain the aspect ratio while also being at or under both of your maximum specified dimensions.

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Storage bucket](https://firebase.google.com/docs/storage) in your Firebase project.

> **NOTE**: As mentioned above, this extension listens for all changes made to the specified Cloud Storage bucket. This may cause unnecessary function calls. It is recommended to create a separate Cloud Storage bucket, especially for images you want to resize, and set up this extension to listen to that bucket.

#### Multiple instances of this extension

You can install multiple instances of this extension for the same project to configure different resizing options for different paths. However, as mentioned before this extension listens for all changes made to the specified Cloud Storage bucket. That means all instances will be triggered every time a file is uploaded to the bucket. Therefore, it is recommended to use different buckets instead of different paths to prevent unnecessary function calls.

#### Troubleshooting

If events are enabled, and you want to create custom event handlers to respond to the events published by the extension, you must ensure that you have the appropriate [role/permissions](https://cloud.google.com/pubsub/docs/access-control#permissions_and_roles) to subscribe to Pub/Sub events.

#### Billing
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
 - Cloud Storage
 - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))
- If you enable events [Eventarc fees apply](https://cloud.google.com/eventarc/pricing).

#### Further reading & resources

You can find more information about this extension in the following articles:

- [Image Optimization With Firebase Extensions](https://invertase.link/ext-resize-images-tutorial)