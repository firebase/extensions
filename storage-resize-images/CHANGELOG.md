## Version 0.1.8

fixed - Resized images now maintain the same orientation as the original image. (Issue #290)

## Version 0.1.7

fixed - Resized images now render in the Firebase console. (Issue #140)
fixed - The Sharp cache is now cleared so that the latest image with a given
file name is retrieved from the Storage bucket. (Issue #286)

## Version 0.1.6

fixed - Switched ImageMagick for Sharp library to support webp format. (Issue #199)

## Version 0.1.5

fixed - The original, uploaded image's MIME type must now always be specified in the `Content-Type` header. (Issue #175)

## Version 0.1.4

fixed - Fixed bug where name of resized file was missing original name if there was no file extension. (issue #20)
fixed - Fixed "TypeError: Cannot set property 'resizedImage' of undefined". (issue #130)
fixed - Fixed bug where some valid bucket names were rejected during configuration. (issue #27)

## Version 0.1.3

feature - Automatically copy the following metadata, if present, from the original image to the resized image(s): `Cache-Control`, `Content-Disposition`, `Content-Encoding`, `Content-Language`, `Content-Type`, and user-provided metadata (except Firebase storage download tokens). Note that you can configure your extension to overwrite the Cache-Control value for the resized image(s).

## Version 0.1.2

feature - Added new param for deleting the original image.

## Version 0.1.1

fixed - Fixed bug where certain edge cases led to already resized image being resized again. (issue #7)

## Version 0.1.0

Initial release of the _Resize Images_ extension.
