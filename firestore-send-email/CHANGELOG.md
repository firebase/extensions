## Version 0.1.37

feat: add support for OAuth2 authentication

fix: default replyTo issue introduced in 0.1.35

fix: sendgrid attachment bug introduced in 0.1.35

## Version 0.1.36

feat - move to Node.js 20 runtimes

## Version 0.1.35

feat - add SendGrid category support

docs - add instructions for setting up Firestore TTL policies for the `delivery.expireAt` field.

## Version 0.1.34

fixed - SendGrid v3 issues (#2020)

fixed - bump dependencies, fix vulnerabilities (#2061)

## Version 0.1.33

fixed - fix issue with sendgrid fields

fixed - fix vulnerabilities and update dependencies

## Version 0.1.32

feature - added support for SendGrid dynamic templates

## Version 0.1.31

docs - updated the description of the `TEMPLATES_COLLECTION` parameter to clarify the use of handlebars templates.

## Version 0.1.30

feature - add a new field "Tls Options" to allow users to specify TLS options for SMTP connections

## Version 0.1.29

fixed - remove missingDeliveryField log
fixed - support hotmail service

## Version 0.1.28

build - updated depenencies

## Version 0.1.27

feature - bump to node 18

## Version 0.1.26

feature - bump to nodejs16

## Version 0.1.25

fixed - change missingDeliveryField logging from `error` to `warn`

## Version 0.1.24

fixed - dont return early

fixed - moved warning about no message and checked if templates are referenced

## Version 0.1.23

fixed - added template check when no message exists

## Version 0.1.22

fixed - fix typo in extension

feature - upgrade extensions to the latest firebase-admin sdk

feature - improve TTL params

feature - add TTL support

fixed - read and write delivery status from inside a single transaction

## Version 0.1.21

feature - add lifecycle events

## Version 0.1.20

docs - add google app passwords guide

## Version 0.1.19

fixed - generate new lib folder

## Version 0.1.18

fixed - added encoding for connection string passwords (#985)

fixed - move log statement outside of forEach loop (#950)

feature - upgrade to the latest emulator updates (#995)

fixed - further updated the extensions regular expression validation to contain additional smtp formats (#909)

fixed - generate correct `package-lock.json` files after `lerna bootstrap` (#779)

fixed - added local smtp server for running tests (#794)

fixed - add SMTP secret password (#840)

fixed - added logging for invalid email messages, documentation updated with firestore example (#710)

fixed - update validate workflow to use node14

## Version 0.1.17

fixed - update SMTP connection URI validation regex (#942)

fixed - hide password from showing up in logs (#943)

## Version 0.1.16

fixed - updated the extensions regular expression validation to contain additional smtp formats (#909)

## Version 0.1.15

fixed - generate correct `package-lock.json` files after `lerna bootstrap` (#779)

fixed - added local smtp server for running tests (#794)

fixed - add SMTP secret password (#840)

fixed - added logging for invalid email messages, documentation updated with firestore example (#710)

fixed - update validate workflow to use node14

## Version 0.1.13

docs - updated POSTINSTALL docs to link to Firebase documentation

## Version 0.1.12

fixed - moved lease expired error message to delivery document (#726)

feature - add Taiwan and Singapore Cloud Function locations (#729)

fixed - empty template attachments fall back to message attachments (#719)

## Version 0.1.11

fixed - added fallback for finding email templates

fixed - removed duplicate Warsaw location

## Version 0.1.10

feature - added Warsaw (europe-central2) location (#677)

feature - updated Cloud Functions runtime to Node.js 14 (#660)

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
