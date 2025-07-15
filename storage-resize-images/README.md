# Resize Images

**Author**: Firebase (**[https://firebase.google.com](https://firebase.google.com)**)

**Description**: Resizes images uploaded to Cloud Storage to a specified size, and optionally keeps or deletes the original image.



**Details**: Use this extension to create resized versions of an image uploaded to a Cloud Storage bucket.

When you upload a file to your specified Cloud Storage bucket, this extension:

- Detects if the file is an image. If it is, then:
  - Creates a resized image with your specified dimensions.
  - Names the resized image using the same name as the original uploaded image, but suffixed with your specified width and height.
  - Stores the resized image in the same Storage bucket as the original uploaded image.

You can even configure the extension to create resized images of different dimensions for each original image upload. For example, you might want images that are 200x200, 400x400, and 680x680 - this extension can create these three resized images then store them in your bucket.

The extension automatically copies the following metadata, if present, from the original image to the resized image(s): `Cache-Control`, `Content-Disposition`, `Content-Encoding`, `Content-Language`, `Content-Type`, and user-provided metadata (a new Firebase storage download token will be generated on the resized image(s) if the original metadata contains a token). Note that you can optionally configure the extension to overwrite the [`Cache-Control`](https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control) value for the resized image(s).

The extension supports resizing images in `JPEG`, `PNG`, `WebP`, `GIF`, `AVIF` and `TIFF` formats, and the output can be in one or more of these formats.

The extension can publish a resize completion event, which you can optionally enable when you install the extension. If you enable events, you can write custom event handlers that respond to these events. You can always enable or disable events later. Events will be emitted via Eventarc.

Furthermore, you can choose if you want to receive events upon the successful completion of the image resizing. Hence, you can do anything based on the event you will receive. For example, you can use [EventArc gen2 functions](https://firebase.google.com/docs/functions/custom-events#handle-events) to be triggered on events published by the extension.

#### Detailed configuration information

To configure this extension, you specify a maximum width and a maximum height (in pixels, px). This extension keeps the aspect ratio of uploaded images constant and shrinks the image until the resized image's dimensions are at or under your specified max width and height.

For example, say that you specify a max width of 200px and a max height of 100px. You upload an image that is 480px wide by 640px high, which means a 0.75 aspect ratio. The final resized image will be 75px wide by 100px high to maintain the aspect ratio while also being at or under both of your maximum specified dimensions.

#### Content Filtering

This extension includes an optional content filtering system to automatically detect and block inappropriate images before resizing them. This feature leverages Google's AI models to analyze uploaded images and take action based on your specified filtering level.

##### Content Filter Levels

You can configure the strictness of content filtering according to your needs:

- **Off**: No content filtering is applied; all images will be processed.
- **Low strictness**: Blocks only high-severity inappropriate content.
- **Medium strictness**: Blocks medium and high severity inappropriate content.
- **High strictness**: Blocks all low, medium, and high severity inappropriate content.

##### Custom Filter Prompts

Beyond the standard content filtering categories, you can define custom filtering criteria by providing a yes/no question as a prompt. For example:

- "Does this image contain a company logo?"
- "Does this image show violent or threatening content?"
- "Is this image inappropriate for children?"

The AI model will evaluate each image against your custom prompt, and only images that meet the criteria will be processed. This provides an additional layer of filtering beyond the standard content categories.

##### Placeholder Images

When an image is blocked by content filtering, the extension will automatically replace it with a placeholder image before processing. You have two options:

1. **Default placeholder**: If no custom placeholder is specified, the extension will use a built-in default placeholder image.

2. **Custom placeholder**: You can provide a path to your own placeholder image within your storage bucket. This lets you use a branded or contextually appropriate image when content is blocked.

##### Implementation Details

When an image fails content filtering:

1. The original image is not resized.
2. The placeholder image (default or custom) is used for generating all configured resized versions.
3. If you've configured a failed images path, the original image is moved to that location with metadata indicating it was blocked by content filtering.
4. If events are enabled, an event is emitted with information about the content filtering result.

##### Benefits of Content Filtering

- **Brand protection**: Prevents inappropriate content from being associated with your application.
- **User safety**: Creates a safer environment for your users by filtering harmful content.
- **Compliance**: Helps meet regulatory requirements for content moderation.
- **Resource optimization**: Saves processing resources by not resizing inappropriate content.

##### Considerations

- Content filtering adds processing overhead to the image resizing workflow.
- AI-based filtering is not flawless, and may occasionally produce false positives or negatives.
- For sensitive applications, consider implementing additional review processes for edge cases.

#### Additional setup

Before installing this extension, make sure that you've [set up a Cloud Storage bucket](https://firebase.google.com/docs/storage) in your Firebase project.

> **NOTE**: As mentioned above, this extension listens for all changes made to the specified Cloud Storage bucket. This may cause unnecessary function calls. It is recommended to create a separate Cloud Storage bucket, especially for images you want to resize, and set up this extension to listen to that bucket.

#### Multiple instances of this extension

You can install multiple instances of this extension for the same project to configure different resizing options for different paths. However, as mentioned before this extension listens for all changes made to the specified Cloud Storage bucket. That means all instances will be triggered every time a file is uploaded to the bucket. Therefore, it is recommended to use different buckets instead of different paths to prevent unnecessary function calls.

#### Troubleshooting

If events are enabled, and you want to create custom event handlers to respond to the events published by the extension, you must ensure that you have the appropriate [role/permissions](https://cloud.google.com/pubsub/docs/access-control#permissions_and_roles) to subscribe to Pub/Sub events.

#### Example Event Handler for Successful Resize Operation
Here is a an example of a custom event handler for events you can choose to emit from this extension:
```typescript
import * as functions from 'firebase-functions';
import { onCustomEventPublished } from 'firebase-functions/v2/eventarc';

export const onImageResized = onCustomEventPublished(
    "firebase.extensions.storage-resize-images.v1.onSuccess",
    (event) => {
        functions.logger.info("Resize Image is successful", event);
        // Additional operations based on the event data can be performed here
        return Promise.resolve();
    }
);
```

#### AI-powered image moderation with Genkit

This extension uses the [Genkit SDK](https://genkit.dev/) to power AI-based content filtering for uploaded images. 

For more information about Genkit, visit the Genkit documentation at [genkit.dev](http://genkit.dev/).

#### Billing
To install an extension, your project must be on the [Blaze (pay as you go) plan](https://firebase.google.com/pricing)

- This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service’s no-cost tier:
 - Cloud Storage
 - Cloud Functions (Node.js 10+ runtime. [See FAQs](https://firebase.google.com/support/faq#extensions-pricing))
- If you enable events [Eventarc fees apply](https://cloud.google.com/eventarc/pricing).

#### Further reading & resources

You can find more information about this extension in the following articles:

- [Image Optimization With Firebase Extensions](https://invertase.link/ext-resize-images-tutorial)



**Configuration Parameters:**

* Cloud Storage bucket for images: To which Cloud Storage bucket will you upload images that you want to resize? Resized images will be stored in this bucket. Depending on your extension configuration, original images are either kept or deleted. It is recommended to create a separate bucket for this extension. For more information, refer to the [pre-installation guide](https://firebase.google.com/products/extensions/storage-resize-images).


* Sizes of resized images: What sizes of images would you like (in pixels)? Enter the sizes as a comma-separated list of WIDTHxHEIGHT values. Learn more about [how this parameter works](https://firebase.google.com/products/extensions/storage-resize-images).


* Deletion of original file: Do you want to automatically delete the original file from the Cloud Storage bucket? Warning: these deletions cannot be undone, and if you reconfigure this instance to use different image dimensions, you won't be able to backfill deleted images.

* Make resized images public: Do you want to make the resized images public automatically? So you can access them by URL. For example: https://storage.googleapis.com/{bucket}/{path}

* Cloud Storage path for resized images: A relative path in which to store resized images. For example, if you specify a path here of `thumbs` and you upload an image to `/images/original.jpg`, then the resized image is stored at `/images/thumbs/original_200x200.jpg`. If you prefer to store resized images at the root of your bucket, leave this field empty.


* Paths that contain images you want to resize: Restrict storage-resize-images to only resize images in specific locations in your Storage bucket by  supplying a comma-separated list of absolute paths. For example, specifying the paths `/users/pictures,/restaurants/menuItems` will resize any images found in any subdirectories of `/users/pictures` and `/restaurants/menuItems`.
You may also use wildcard notation for directories in the path. For example, `/users/*/pictures` would include any images in any subdirectories of `/users/foo/pictures` as well as any images in subdirectories of `/users/bar/pictures`, but also any images in subdirectories of `/users/any/level/of/subdirectories/pictures`. 
If you prefer not to explicitly restrict to certain directories of your Storage bucket, leave this field empty.


* List of absolute paths not included for resized images: Ensure storage-resize-images does *not* resize images in _specific locations_ in your Storage bucket by  supplying a comma-separated list of absolute paths. For example, to *exclude* the images  stored in the `/foo/alpha` and its subdirectories and `/bar/beta` and its subdirectories, specify the paths `/foo/alpha,/bar/beta`.
You may also use wildcard notation for directories in the path. For example, `/users/*/pictures` would exclude any images in any subdirectories of `/users/foo/pictures` as well as any images in subdirectories of `/users/bar/pictures`, but also any images in subdirectories of `/users/any/level/of/subdirectories/pictures`.
If you prefer to resize every image uploaded to your Storage bucket, leave this field empty.


* Cloud Storage path for failed images: A relative path in which to store failed images. For example, if you specify a path here of `failed` and you upload an image to `/images/original.jpg`, then resizing failed, the image will be stored at `/images/failed/original.jpg`.
Leave this field empty if you do not want to store failed images in a separate directory.


* Cache-Control header for resized images: This extension automatically copies any `Cache-Control` metadata from the original image to the resized images. For the resized images, do you want to overwrite this copied `Cache-Control` metadata or add `Cache-Control` metadata? Learn more about [`Cache-Control` headers](https://developer.mozilla.org/docs/Web/HTTP/Headers/Cache-Control). If you prefer not to overwrite or add `Cache-Control` metadata, leave this field empty.


* Convert image to preferred types: The image types you'd like your source image to convert to.  The default for this option will be to keep the original file type as the destination file type.


* Output options for selected formats: Provide an optional output option as a stringified object containing Sharp Output Options for selected image types conversion. eg. `{"jpeg": { "quality": 5, "chromaSubsampling": "4:4:4" }, "png": { "palette": true }}` and `{"png":{"compressionLevel":9}}`. The `"compressionLevel": 9` specifies the level of compression for PNG images. Higher numbers here indicate greater compression, leading to smaller file sizes at the cost of potentially increased processing time and possible loss of image quality.


* Sharp constructor options for resizing images: Provide an optional stringified Sharp ResizeOptions object to customize resizing behavior, eg. `{ "fastShrinkOnLoad": false, "position": “centre”, "fit": "inside" }` The `"fit": "inside"` option ensures the image fits within given dimensions, maintaining aspect ratio, scaling down as needed without cropping or distortion. Learn more about [`Sharp constructor options`](https://sharp.pixelplumbing.com/api-resize#resize).


* GIF and WEBP animated option: Keep animation of GIF and WEBP formats.


* Cloud Function memory: Memory of the function responsible of resizing images.  Choose how much memory to give to the function that resize images. (For animated GIF => GIF we recommend using a minimum of 2GB).

* Backfill existing images: Should existing, unresized images in the Storage bucket be resized as well?


* Assign new access token: Should resized images have a new access token assigned to them,  different from the original image?


* Content filter level: Set the level of content filtering to apply to uploaded images. Choose 'OFF' to disable content filtering entirely, 'BLOCK_ONLY_HIGH' to block only high-severity inappropriate content, 'BLOCK_MEDIUM_AND_ABOVE' for medium and high severity content, or 'BLOCK_LOW_AND_ABOVE' for the strictest filtering (blocks low, medium, and high severity content).


* Custom content filter prompt: Optionally, provide a custom prompt for content filtering. This allows you to define specific criteria for filtering beyond the standard categories. Note that this prompt should be a yes/no question. For example, "Does this image contain a cat?" will filter out images that Gemini thinks contain a cat. This is additional filtering on top of whichever content filtering level you choose. Leave empty to use just your selected built-in content filtering configuration.


* Path to placeholder image: Optionally, specify a path to a placeholder image to use when an uploaded image is blocked by content filtering. This should be a relative path within your storage bucket. If not provided, a default placeholder image is used.




**Cloud Functions:**

* **generateResizedImage:** Listens for new images uploaded to your specified Cloud Storage bucket, resizes the images, then stores the resized images in the same bucket. Optionally keeps or deletes the original images.

* **backfillResizedImages:** Handles tasks from startBackfill to resize existing images.



**APIs Used**:

* storage-component.googleapis.com (Reason: Needed to use Cloud Storage)



**Access Required**:



This extension will operate with the following project IAM roles:

* storage.admin (Reason: Allows the extension to store resized images in Cloud Storage)

* aiplatform.user (Reason: Allows use of Gemini models for AI content filtering, if enabled.)
