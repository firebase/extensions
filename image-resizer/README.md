# Resize images in Cloud Storage

**Description**: Resize new images uploaded to a Cloud Storage bucket to a specified size. Both the original and the resized images are stored in the same bucket. Additionally, you can configure this mod to generate the signed URLs for both images and to store the URLs in Realtime Database.



**Details**: Use this mod to create resized versions of an image uploaded to a Cloud Storage bucket.

Whenever an image file is uploaded to your specified Cloud Storage bucket, this mod creates a resized image with your specified dimensions. Both the original uploaded image and the resized image are saved in the same Storage bucket. The resized image file uses the same name as the original uploaded image, but the filename is suffixed with your specifed width and specified height. Note that you might need to refresh the dashboard to see the new file for the resized image.

When you configure this mod, you specify a maximum height and a maximum width (in pixels, px). This mod keeps the aspect ratio of uploaded images constant and shrinks the image until the resized image's dimensions are at or under your specified max height and width. For example, say that you specify a max height of 200px and a max width of 100px for resized images. An uploaded image is 480px high by 640px wide. The final image will be 75px high by 100px wide to maintain the aspect ratio of 0.75 while being at or under both of your maximum specified dimensions.

You can upload images to a Cloud Storage bucket directly in the Firebase console's Storage dashboard. Alternatively, you can upload images using the [Cloud Storage for Firebase SDK](https://firebase.google.com/docs/storage/) for your platform (iOS, Android, or Web).

This mod also optionally creates then writes [signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls) to your specified Firebase Realtime Database path - both for the original image and the resized image. Signed URLs are a mechanism for query string authentication for buckets and objects by providing a way to give time-limited read or write access to anyone in possession of the URL, regardless of whether they have a Google account. How to use the signed URLs is up to you. One example use case could be for a webpage that displays all members of a club. You could attach a listener to the database path so that when the mod creates a new resized image, both the original and the resized image are fetched immediately and displayed on the webpage.

When you use Firebase Mods, you're only charged for the underlying resources that you use. Firebase Mods themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)




**Configuration Parameters:**

* Deployment location: Where should the mod be deployed? You usually want a location close to your database. Realtime Database instances are located in us-central1. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Cloud Storage bucket for images: Which Cloud Storage bucket will contain the uploaded images that you want to resize? This bucket will also store the resized images.


* Maximum height of resized image: What do you want the maximum height of resized images to be (in pixels)? Learn more about [how this parameter works](https://firebase.google.com/products/mods/image-resizer).


* Maximum width of resized image: What do you want the maximum width of resized images to be (in pixels)? Learn more about [how this parameter works](https://firebase.google.com/products/mods/image-resizer).


* (Optional) Realtime Database path for signed URLs for images: What is the Realtime Database path where you want to store signed URLs for the original and resized images? Learn more about [how this parameter works](https://firebase.google.com/products/mods/image-resizer). If you prefer to not use signed URLs, leave this field empty.


* (Optional) Date after which signed URLs will expire (MM-DD-YYYY): After what date do you want the signed URLs to expire? Enter the date in MM-DD-YYYY format. If you prefer to not use signed URLs, leave this field as the default.


* (Optional) `cache-control` header for resized images: Do you want to specify a `cache-control` header for the resized image files? Learn more about `cache-control` headers: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control If you prefer not to use a `cache-control` header, leave this field empty.




**Cloud Functions:**

* **generateResizedImage:** Listens for new images uploaded to your specified Cloud Storage bucket, resizes the images, then stores both images in the same Cloud Storage bucket.



**APIs Used**:

* storage-component.googleapis.com (Reason: Needed to use Cloud Storage)



**Access Required**:



This mod will operate with the following project IAM roles:

* storage.admin (Reason: Allows the mod to store resized images in Cloud Storage)

* iam.serviceAccountTokenCreator (Reason: Allows the mod to generate signed URLs)

* firebasedatabase.admin (Reason: Allows the mod to store signed URLs in Realtime Database)
