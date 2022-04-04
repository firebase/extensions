Use this extension to create resized versions of an image uploaded to a Cloud Storage bucket.

When you upload a file to your specified Cloud Storage bucket, this extension:

- Detect if the file is an image. If it is, then:
  - Creates a resized image with your specified dimensions.
  - Names the resized image using the same name as the original uploaded image, but suffixed with your specified width and height.
  - Stores the resized image in the same Storage bucket as the original uploaded image.

You can even configure the extension to create resized images of different dimensions for each original image upload. For example, you might want images that are 200x200, 400x400, and 680x680 - this extension can create these three resized images then store them in your bucket.

The extension automatically copies the following metadata, if present, from the original image to the resized image(s): `Cache-Control`, `Content-Disposition`, `Content-Encoding`, `Content-Language`, `Content-Type`, and user-provided metadata (a new Firebase storage download token will be generated on the resized image(s) if the original metadata contains a token). Note that you can optionally configure the extension to overwrite the [`Cache-Control`](https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control) value for the resized image(s).

#### Detailed configuration information

To configure this extension, you specify a maximum width and a maximum height (in pixels, px). This extension keeps the aspect ratio of uploaded images constant and shrinks the image until the resized image's dimensions are at or under your specified max width and height.

For example, say that you specify a max width of 200px and a max height of 100px. You upload an image that is 480px wide by 640px high, which means a 0.75 aspect ratio. The final resized image will be 75px wide by 100px high to maintain the aspect ratio while also being at or under both of your maximum specified dimensions.

##### Naming Convention

By default, the extension creates resized images with the same name as the original uploaded image but suffixed with your specified width and height (`{original-name}_{size}{extension}`). For example, if you upload an image named `my-image.jpg` and specify a width of 200px and a height of 100px, the extension will create a resized image named `my-image_200x100.jpg`.

However, you can change how the resized image is named by specifying a custom naming convention. You can use the following variables in your naming convention:

- `{original-name}` - the original name of the image.
- `{size}` - the size of the resized image (`WIDTHxHEIGHT`).
- `{extension}` - the extension of the resized image.

For example, if you specify a naming convention of `photo_{size}_{original-name}{extension}`, the extension will create a resized image named `photo_200x100_my-image.jpg`.

Also, you can specify a custom name convention for each size you specify. For example, if you have a specified size of `200x200,400x400,800x800` and a specified name convention of `200x200={original-name}_small{extension},400x400={original-name}_medium{extension},800x800={original-name}_large{extension}` the resized images will be named `my-image_small.jpg`, `my-image_medium.jpg`, and `my-image_large.jpg` respectively.

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Storage bucket](https://firebase.google.com/docs/storage) in your Firebase project.

> **NOTE**: As mentioned above, this extension listens for all changes made to the specified Cloud Storage bucket. This may cause unnecessary function calls. It is recommended to create a separate Cloud Storage bucket, especially for images you want to resize, and set up this extension to listen to that bucket.

#### Multiple instances of this extension

You can install multiple instances of this extension for the same project to configure different resizing options for different paths. However, As mentioned before this extension listens for all changes made to the specified Cloud Storage bucket. That means all instances will be triggered every time a file is uploaded to the bucket. Therefore, it is recommended to use different buckets instead of different paths to prevent unnecessary function calls.

#### Billing
 
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)
 
- You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s free tier:
- Cloud Storage
- Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))
