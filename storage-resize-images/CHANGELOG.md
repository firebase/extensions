## Version 0.2.8

fixed - support '+' character in paths

docs - fix typo in PREINSTALL.md

fixed - handle paths correctly on windows

## Version 0.2.7

fixed - maintain aspect ratio of resized images (#2115)

feat - move to Node.js 20 runtimes

## Version 0.2.6

fixed - bump dependencies, fix vulnerabilities

## Version 0.2.5

fixed - bump dependencies, fix vulnerabilities (#2061)

## Version 0.2.4

fixed - bumped dependencies to latest versions, addressing dependency vulnerabilities

## Version 0.2.3

docs - add a sample explaining how to use custom events

docs - update the description of the `SHARP_OPTIONS` param to include an explanation of the `fit` option

feat - allow regenerating new tokens for resized images

## Version 0.2.2

feature - allow custom fit option

feature - add 4 and 8 GB memory options

## Version 0.2.1

feature - allow custom sharp.js options

fix - convert storage path separators on windows

## Version 0.2.0

fixed - added safeguards for travsersed paths on failed image uploads

build - updated depenencies

## Version 0.1.39

fixed - add support for jpg content types

## Version 0.1.38

feature - bump to node 18

## Version 0.1.37

feature - bump to nodejs16

fixed - correct include path list description

## Version 0.1.36

fixed - added fixes for gcs vulnerabilities

## Version 0.1.35

feature - handle jfif extensions correctly

## Version 0.1.34

feature - upgrade extensions to the latest firebase-admin sdk

fixed - support backfill task in custom region

feature - add description to the failedImagesPath param

feature - put failed resizes in separate directory #563

## Version 0.1.33

fixed - re-add input object data to the complete event

## Version 0.1.32

feature - added lifecycle event to resize existing images

## Version 0.1.31

feature - add AVIF codec support

feature - update IMG_BUCKET param type to selectResource

## Version 0.1.30

feature - include original image data in events

## Version 0.1.29

fixed - add size to metadata

feature - add an option to make the resized images public

fixed - updated sharp lib dependency for improved compression algorithm

## Version 0.1.28

feature - added extension event for image resize completion (#967)

## Version 0.1.27

fixed - update to firebase-admin v10 (#935)

feature - add output options param, to support [Sharp Output Options](https://sharp.pixelplumbing.com/api-output#jpeg) (#878)

## Version 0.1.26

fixed - generate correct `package-lock.json` files after `lerna bootstrap` (#779)

fixed - update resized metadata content disposition (#839)

feature - add WEBP and GIF animation (#875)

fixed - update validate workflow to use node14

fixed - fix samsung encoded jpg resizing

## Version 0.1.25

fixed - fix errors when resizing Samsung-encoded JPEGs

## Version 0.1.24

fixed - update package lock file to fix installation errors (#782)

## Version 0.1.23

feature - add Taiwan and Singapore Cloud Function locations (#729)

## Version 0.1.22

feature - added Warsaw (europe-central2) location (#677)

feature - updated Cloud Functions runtime to Node.js 14 (#660)

## Version 0.1.20

feature - Adds support for wildcards in include/exclude paths (#568)

## Version 0.1.19

feature - Adds support for converting to more than one image format (#579)

## Version 0.1.18

fixed - fixed a bug that caused resized images to be named incorrectly if their file extension was capitalized (#549)

## Version 0.1.17

docs - Adds documentation that explains which content types are supported, and shows how to set content type explicitly (#534)

## Version 0.1.16

feature - Adds support for absolute paths restrictions for Storage Resize Image (#427)

## Version 0.1.15

fixed - extension bug. File name incorrect if non-standard file name (#477)

## Version 0.1.14

feature - Added a "delete only on success" option to the `DELETE_ORIGINAL_FILE` param (#479)

## Version 0.1.13

feature - Add new parameter to optionally convert each uploaded image to a different image content-type (PR #483)

## Version 0.1.12

fixed - ignore gzipped images (PR #417)

feature - Add new Cloud Functions locations. For more information about locations and their pricing tiers, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

## Version 0.1.11

feature - Update Cloud Functions runtime to Node.js 10.

## Version 0.1.10

fixed - A fresh token is now generated for each resized image. (Issue #323, PR #351)

## Version 0.1.9

changed - If the original image is a vector image, the extension does not resize it. (Issue #326, PR #329)

fixed - Replaced `mkdirp-promise` with `mkdirp` because `mkdirp-promise` is deprecated. (PR #266)

fixed - If the original image is smaller than the specified max width and height, the extension does not enlarge it or resize it. (Issue #337, PR #338)

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
