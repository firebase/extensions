## Version 0.1.10

feature - added warsaw (europe-central2) location (#677)

## Version 0.1.9

feature - Allow attachments within template records to be interpolated with data values passed into a new record in the mail collection. (#519)

## Version 0.1.8

docs - updated "SMTP connection URI" parameter description to clarify which ports are recommended for SMTP connections (#582)

## Version 0.1.7

fixed - Switch from `console.log` to `functions.logger.log` for cleaner log outputs.

## Version 0.1.6

feature - adds support for Handlebars partials (#419)

feature - Add new Cloud Functions locations. For more information about locations and their pricing tiers, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

## Version 0.1.5

feature - Update Cloud Functions runtime to Node.js 10.

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
