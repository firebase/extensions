# storage-resize-images

**VERSION**: 0.1.0

**DESCRIPTION**: Resizes images uploaded to Cloud Storage to a specified size, and stores both the original and resized images.



**CONFIGURATION PARAMETERS:**

* Deployment location: Where should the extension be deployed? You usually want a location close to your Storage bucket. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Cloud Storage bucket for images: To which Cloud Storage bucket will you upload images that you want to resize? This bucket will store both the original and resized images.


* Sizes of resized images: What sizes of images would you like (in pixels)? Enter the sizes as a comma-separated list of WIDTHxHEIGHT values.


* Cloud Storage path for resized images: A relative path in which to store resized images. For example, if you specify a path here of `thumbs` and you upload an image to `/images/original.jpg`, then the resized image is stored at `/images/thumbs/original_200x200.jpg`. If you prefer to store resized images at the root of your bucket, leave this field empty. Learn more about [how this parameter works](https://firebase.google.com/products/extensions/storage-resize-image).


* Cache-Control header for resized images: Do you want to specify a `Cache-Control` header for the resized image files? Learn more about [`Cache-Control` headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control). If you prefer not to use a `Cache-Control` header, leave this field empty.




**CLOUD FUNCTIONS CREATED:**

* generateResizedImage (google.storage.object.finalize)



**DETAILS**: Use this extension to create resized versions of an image uploaded to a Cloud Storage bucket.

When you upload an image file to your specified Cloud Storage bucket, this extension:

- Creates a resized image with your specified dimensions.
- Stores the resized image in the same Storage bucket as the original uploaded image.
- Names the resized image using the same name as the original uploaded image, but suffixed with your specified width and height.

You can even configure the extension to create resized images of different dimensions for each original image upload. For example, you might want images that are 200x200, 400x400, and 680x680 - this extension can create these three resized images then store them in your bucket.

Another optional feature of this extension is to specify a [`Cache-Control` header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control) for your resized image files.

#### Detailed configuration information

To configure this extension, you specify a maximum width and a maximum height (in pixels, px). This extension keeps the aspect ratio of uploaded images constant and shrinks the image until the resized image's dimensions are at or under your specified max width and height.

For example, say that you specify a max width of 200px and a max height of 100px. You upload an image that is 480px wide by 640px high, which means a 0.75 aspect ratio. The final resized image will be 75px wide by 100px high to maintain the aspect ratio while also being at or under both of your maximum specified dimensions.

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Storage bucket](https://firebase.google.com/docs/storage) in your Firebase project.

#### Billing

This extension uses other Firebase or Google Cloud Platform services which may have associated charges:

- Cloud Storage
- Cloud Functions

When you use Firebase Extensions, you're only charged for the underlying resources that you use. A paid-tier billing plan is only required if the extension uses a service that requires a paid-tier plan, for example calling to a Google Cloud Platform API or making outbound network requests to non-Google services. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)



**APIS USED**:

* storage-component.googleapis.com (Reason: Needed to use Cloud Storage)



**ACCESS REQUIRED**:



This extension will operate with the following project IAM roles:

* storage.admin (Reason: Allows the extension to store resized images in Cloud Storage)
