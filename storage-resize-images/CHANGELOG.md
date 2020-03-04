## Version 0.1.5

fixed - ensure content type is always available (issue #175)

## Version 0.1.4

fixed - Fixed bug where name of resized file was missing original name if there was no file extension (issue #20).
fixed - Fixed "TypeError: Cannot set property 'resizedImage' of undefined" (issue #130).
fixed - Fixed bug where some valid bucket names were rejected during configuration (issue #27).

## Version 0.1.3

feature - Automatically copy the following metadata, if present, from the original image to the resized image(s): `Cache-Control`, `Content-Disposition`, `Content-Encoding`, `Content-Language`, `Content-Type`, and user-provided metadata (except Firebase storage download tokens). Note that you can configure your extension to overwrite the Cache-Control value for the resized image(s).

## Version 0.1.2

feature - Added new param for deleting the original image.

## Version 0.1.1

fixed - Fixed bug where certain edge cases led to already resized image being resized again (issue #7).

## Version 0.1.0

Initial release of the _Resize Images_ extension.
