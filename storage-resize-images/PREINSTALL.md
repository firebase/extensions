Use this extension to create resized versions of an image uploaded to a Cloud Storage bucket.

When you upload an image file to your specified Cloud Storage bucket, this extension creates a resized image with your specified dimensions. It stores both the resized image and the original image in the same Storage bucket. The extension names the resized image using the same name as the original uploaded image, but suffixed with your specified width and height.

You can even configure the extension to create resized images of different dimensions for each original image upload. For example, you might want images that are 200x200, 400x400, and 680x680 - this extension can create these three resized images then store them in your bucket.

To configure this extension, you specify a maximum width and a maximum height (in pixels, px). This extension keeps the aspect ratio of uploaded images constant and shrinks the image until the resized image's dimensions are at or under your specified max width and height. For example, say that you specify a max width of 200px and a max height of 100px. You upload an image that is 480px wide by 640px high, which means a 0.75 aspect ratio. The final resized image will be 75px wide by 100px high to maintain the aspect ratio while also being at or under both of your maximum specified dimensions.

You can upload images using the [Cloud Storage for Firebase SDK](https://firebase.google.com/docs/storage/) for your platform (iOS, Android, or Web). Alternatively, you can upload images directly in the Firebase console's Storage dashboard.

Another optional feature of this extension is to specify a [`Cache-Control` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control) for your resized image files.

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Storage bucket](https://firebase.google.com/docs/storage) in your Firebase project.

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:
- Cloud Storage
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)
