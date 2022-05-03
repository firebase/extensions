# SMTP connection URL

Created: April 27, 2022 4:38 AM
Last Edited Time: April 29, 2022 12:28 PM
Status: In Progress

## Set up the SMTP connection

While setting up the Email Trigger extension, you will be prompted to provide an SMTP server connection. It will be used to connect to the email delivery service you use (e.g., Sendgrid, Mailgun, Mailchimp) to send emails.

A simple SMTP connection URL might look something like this:

`smtp(s)://username@smtp.example.com:port`

## Set up the SMTP connection URL

While setting up the Email Trigger extension, you will be prompt to provide an SMTP connection URL. It'll be used to connect to your email delivery service (i.e., Sendgrid, Mailgun, Mailchimp) to send emails.

SMTP (Simple Mail Transfer Protocol), is an application used by mail servers (almost every email delivery service uses it) to send, receive and/or relay outgoing mail between email senders and receivers.

A simple SMTP connection URL may consist of a `protocol` (should be either **smtp** or **smtps**), `username`, `password`, `host`, and `port`.

All of these components can be found by doing a small Google search on your email delivery service’s SMTP settings (e.g., Sendgrid SMTP settings).

> Note that port 25 is blocked by Google Cloud Platform (to avoid spam), so we recommend using port 587 for SMTP and 465 SMTPS connections.
>

For a more secure connection, you can save your password in the Google Secret Manager by providing a connection URL without a password like:

`smtp(s)://username@smtp.example.com:port`

Up next you will be prompt to enter the password and it will be automatically saved to the Secret Manager.

> Note: OAuth2 authentication connection (mostly used with Gmail and Google Workspace) is not supported currently. If you want to use this extension with a Google-provided email delivery service you have to enable [Less secure apps](https://support.google.com/accounts/answer/6010255) on your account.
>