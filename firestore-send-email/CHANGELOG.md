## Version 0.1.4

feature - Updated "Default FROM address" parameter to accept either an email address (`foobar@example.com`) _or_ a name plus email address (`Friendly Firebaser <foobar@example.com>`). (issue #167)

## Version 0.1.3

fixed - Disables HTML escaping for plain text fields when using the `templates` option.

## Version 0.1.2

feature - Support custom email headers. The extension reads from the `headers` field in the Cloud Firestore document (detailed instructions provided in the [POSTINSTALL file](https://github.com/firebase/extensions/blob/master/firestore-send-email/POSTINSTALL.md#using-this-extension). (issue #77)

## Version 0.1.1

fixed - Fixed "cold start" errors experienced when the extension runs after a period of inactivity (issue #48).

## Version 0.1.0

Initial release of the _Trigger Email_ extension.
