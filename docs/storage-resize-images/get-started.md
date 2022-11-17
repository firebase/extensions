# Get started

## Using the Resize Images extension

The Resize Images extension (`storage-resize-images`) lets you automatically change (in most cases, reduce) the size of images saved to a specified Cloud Storage bucket and optionally keep or delete the originals. Adding an image to the bucket triggers this extension to create a new resized copy or more of the image.

The extension supports the following features:

- Create a resized copy or more of the image at once (i.e., 200x200,400x400).
- Convert the image to a preferred type or more at once (i.e., `.jpeg`, `.webp`).
- Automatically, delete the original image after processing is finished.

## Pre-installation setup

Before installing this extension, make sure that you've [set up a Cloud Storage bucket](https://firebase.google.com/docs/storage)
 in your Firebase project.

> This extension listens for all changes made to the specified Cloud Storage bucket. This may cause unnecessary function calls. It is recommended to create a separate Cloud Storage bucket, especially for images you want to resize, and set up this extension to listen to that bucket.

## **Install the extension**

To install the extension, follow the steps on the [Install Firebase Extension](https://firebase.google.com/docs/extensions/install-extensions) page. In summary, do one of the following:

- **Firebase console:** Click the following button:

  [Install the Storage Resize Images extension](https://console.firebase.google.com/project/_/extensions/install?ref=firebase%2Fstorage-resize-images)

- **CLI:** Run the following command:

  ```bash
  firebase ext:install firebase/storage-resize-images --project=projectId-or-alias
  ```

During the installation of the extension, you will be prompted to specify a number of configuration parameters:

- **Cloud Functions location:**

  Select the location of where you want to deploy the functions created for this extension. You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

- **Cloud Storage bucket:**

  To which Cloud Storage bucket will you upload images that you want to resize?
  Resized images will be stored in this bucket. Depending on your extension configuration,
  original images are either kept or deleted. It is recommended to create a separate bucket for this extension. For more information, refer to the [pre-installation guide](https://firebase.google.com/products/extensions/storage-resize-images).

- **Sizes of resized images:**

  What sizes of images (in pixels) would you like? Enter the sizes as a
  comma-separated list of WIDTHxHEIGHT values. Learn more about [how this parameter works](https://firebase.google.com/products/extensions/storage-resize-images).

- **Deletion of the original file:**

  Do you want to automatically delete the original file from the Cloud Storage
  bucket? Note that these deletions cannot be undone.

- **Cloud Storage path for resized images:**

  A relative path in which to store resized images. For example, if you specify a path of `thumbs` and you upload an image to `/images/original.jpg`, then the resized image is stored at `/images/thumbs/original_200x200.jpg`. If you prefer to store resized images at the root of your bucket, leave this field empty.

- **Paths that contain images you want to resize:**

  Restrict storage-resize-images to only resize images in specific locations in your Storage bucket by supplying a comma-separated list of absolute paths. For example, to only resize the images stored in the `/users/pictures` and `/restaurants/menuItems` directories, specify the paths `/users/pictures,/restaurants/menuItems`.

  You may also use wildcard notation for directories in the path. For example, `/users/*/pictures` would match `/users/profile/pictures/image.png` as well as `/users/profile/pictures/any/sub/directory/image.png`.

  If you prefer to resize every image uploaded to your Storage bucket, leave this field empty.

- **List of absolute paths not included for resized images:**

  Ensure storage-resize-images does _not_ resize images in _specific locations_ in your Storage bucket by supplying a comma-separated list of absolute paths. For example to _exclude_ the images stored in the `/users/pictures` and `/restaurants/menuItems` directories, specify the paths `/users/pictures,/restaurants/menuItems`.

  You may also use wildcard notation for directories in the path. For example, `/users/*/pictures` would exclude `/users/profile/pictures/image.png` as well as `/users/profile/pictures/any/sub/directory/image.png`.

  If you prefer to resize every image uploaded to your Storage bucket,
  leave this field empty.

- **Cache-Control header for resized images:**

  This extension automatically copies any `Cache-Control` metadata from the original image to the resized images. For the resized images, do you want to overwrite this copied `Cache-Control` metadata or add `Cache-Control` metadata? Learn more about `[Cache-Control` headers](<https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control>). If you prefer not to overwrite or add `Cache-Control` metadata, leave this field empty.

- **Convert image to preferred types:**

  The types of images you want to convert the source image to. The default for this parameter will be to keep the original file type.

- **Output options for selected formats:**

  Provide a optional output option stringified object containing Sharp Output Options for selected image types conversion. eg. `{"jpeg": { "quality": 5, "chromaSubsampling": "4:4:4" }, "png": { "pallete": true }}`

- **GIF and WEBP animated option:**

  Either to keep animation of GIF and WEBP formats.

- **Cloud Function memory:**

  The memory of the function that is responsible for resizing images. Choose how much memory to give to the function that resizes images. (For animated GIF => GIF we recommend using a minimum of 2GB).

## Use the extension

After installation, this extension monitors all image uploads to the bucket you configured. Whenever an image upload is detected, this extension:

- Creates a resized image with your specified dimensions.
- Names the resized image using the same name as the original uploaded image, but suffixed with your specified width and height.
- Stores the resized image in the same Storage bucket as the original uploaded image.

## Multiple instances of this extension

You can install multiple instances of this extension for the same project to configure different resizing options for different paths. However, as mentioned before this extension listens for all changes made to the specified Cloud Storage bucket. That means all instances will be triggered every time a file is uploaded to the bucket. Therefore, it is recommended to use a different bucket for each instance instead of a different path to prevent unnecessary function calls.

## Advanced use

Learn about more advanced use of this extension:

[Customize o**utput options**](https://www.notion.so/Customize-output-options-d87cc4d3489b4a89831543601b982c00)

[Handle Resize Image Extension events](https://www.notion.so/Handle-Resize-Image-Extension-events-6b4a7d75e9ef4812b67f84fbdb4015c0)
