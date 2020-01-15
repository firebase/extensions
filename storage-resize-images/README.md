# Resize Images

**Description**: Resizes images uploaded to Cloud Storage to a specified size, and optionally keeps or deletes the original image.



**Details**: Use this extension to create resized versions of an image uploaded to a Cloud Storage bucket.

When you upload an image file to your specified Cloud Storage bucket, this extension:

- Creates a resized image with your specified dimensions.
- Names the resized image using the same name as the original uploaded image, but suffixed with your specified width and height.
- Stores the resized image in the same Storage bucket as the original uploaded image.

You can even configure the extension to create resized images of different dimensions for each original image upload. For example, you might want images that are 200x200, 400x400, and 680x680 - this extension can create these three resized images then store them in your bucket.

The extension automatically copies the following metadata, if present, from the original image to the resized image(s): `Cache-Control`, `Content-Disposition`, `Content-Encoding`, `Content-Language`, `Content-Type`, and user-provided metadata (except Firebase storage download tokens). Note that you can optionally configure the extension to overwrite the [`Cache-Control`](https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control) value for the resized image(s).

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




**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension?  You usually want a location close to your Storage bucket. For help selecting a  location, refer to the [location selection  guide](https://firebase.google.com/docs/functions/locations).

* Cloud Storage bucket for images: To which Cloud Storage bucket will you upload images that you want to resize? Resized images will be stored in this bucket. Depending on your extension configuration, original images are either kept or deleted.


* Sizes of resized images: What sizes of images would you like (in pixels)? Enter the sizes as a comma-separated list of WIDTHxHEIGHT values. Learn more about [how this parameter works](https://firebase.google.com/products/extensions/storage-resize-images).


* Deletion of original file: Do you want to automatically delete the original file from the Cloud Storage bucket? Note that these deletions cannot be undone.

* Cloud Storage path for resized images: A relative path in which to store resized images. For example, if you specify a path here of `thumbs` and you upload an image to `/images/original.jpg`, then the resized image is stored at `/images/thumbs/original_200x200.jpg`. If you prefer to store resized images at the root of your bucket, leave this field empty.


* Cache-Control header for resized images: This extension automatically copies any `Cache-Control` metadata from the original image to the resized images. For the resized images, do you want to overwrite this copied `Cache-Control` metadata or add `Cache-Control` metadata? Learn more about [`Cache-Control` headers](https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control). If you prefer not to overwrite or add `Cache-Control` metadata, leave this field empty.




**Cloud Functions:**

* **generateResizedImage:** Listens for new images uploaded to your specified Cloud Storage bucket, resizes the images, then stores the resized images in the same bucket. Optionally keeps or deletes the original images.



**APIs Used**:

* storage-component.googleapis.com (Reason: Needed to use Cloud Storage)



**Access Required**:



This extension will operate with the following project IAM roles:

* storage.admin (Reason: Allows the extension to store resized images in Cloud Storage)
