## Version 0.1.3

feature - Automatically copy the following metadata, if present, from the original image to the resized image(s): `Cache-Control`, `Content-Disposition`, `Content-Encoding`, `Content-Language`, `Content-Type`, and user-provided metadata (except Firebase storage download tokens). Note that you can configure your extension to overwrite the Cache-Control value for the resized image(s).

## Version 0.1.2

feature - Add new param for deleting the original image.

## Version 0.1.1

fixed - Fixed bug where certain edge cases led to already resized image being resized again (issue #7).

## Version 0.1.0

Initial release of the _Resize Images_ extension.
