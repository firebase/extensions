Use this extension to create resized versions of an image uploaded to a Cloud Storage bucket.

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