# SMTP server connection

## **Set up the SMTP connection**

While setting up the Email Trigger extension, you will be prompted to provide an SMTP server connection. It will be used to connect to the email delivery service you use (e.g., Sendgrid, Mailgun, Mailchimp) to send emails.

## What is SMTP

SMTP stands for Simple Mail Transfer Protocol, an application used by (almost) all mail servers to send, receive, and/or relay outgoing mail between email senders and recipients.

## Find your SMTP server settings

A simple SMTP connection URL may consist of a **protocol** (should be either **smtp** or **smtps**), **username**, **password**, **host**, and **port**.

You can find all of these components by doing a small Google search on the SMTP settings for the email delivery service you are using (for example, Sendgrid SMTP settings).

### Providers

Some providers have specific guides for what credemtials can be used.

#### Gmail (Setup Google App Passwords)

**Google** no longer allows **Gmail** users to use their own passwords to authorize third-party apps and services. Instead, you have to use the [Sign in with App Passwords](https://support.google.com/accounts/answer/185833) service to generate a special password for each app you want to authorize. To do so:

1. Go to your [Google Account](https://myaccount.google.com/).
2. Select **Security**.
3. Under "Signing in to Google," select **App Passwords**. You may need to sign in. If you don’t have this option, it might be because:
   1. 2-Step Verification is not set up for your account.
   2. 2-Step Verification is only set up for security keys.
   3. Your account is through work, school, or other organization.
   4. You turned on Advanced Protection.
4. At the bottom, choose **Select app** and choose **Other** option and then write the name of the app password (e.g. `Firebase Trigger Email from Firestore Extension`) and click **Generate**.
5. Follow the instructions to enter the App Password. The App Password is the 16-character code in the yellow bar on your device.
6. Tap **Done**.

Now you can use your Google username with the generated password to authorize the extension.

## Extension Configuration

There are two methods that can be used to configure the extension with the SMTP server settings in terms of where to save the password:

### 1. Using Google **Secret Manager**

[Google Secret Manager](https://cloud.google.com/secret-manager/docs/overview) is a secure and convenient storage system for API keys, passwords, certificates, and other sensitive data. Secret Manager provides a central place and single source of truth to manage, access, and audit secrets across Google Cloud.

To establish a secure connection to the SMTP server using Google Secret Manager, you can enter an SMTP connection URL that does not include a password and save your password in Google Secret Manager. for example:

`smtps://username@gmail.com@smtp.gmail.com:465`

> Note that port 25 is blocked by Google Cloud Platform (to avoid spam), so we recommend using port 587 for SMTP and 465 SMTPS connections.

Up next you will be prompt to enter your password and it will be (automatically) saved to Google Secret Manager.

### 2. Using Inline Password

For an easier (but less secure) connection, you can include your password directly in the connection URL. for example:

`smtps://username@gmail.com:password@smtp.gmail.com:465`

If you want to use this method, you can leave the password parameter field blank and continue.

## Query Parameters

You may need to send query params to configure connection options and this is also available, for example:

`smtp(s)://username@hostname:port/?pool=true`

## Gmail and Google Workspace

Some service providers like Gmail and Google Workspace use OAuth2 authentication to allow third-party applications to connect to the SMTP server.

OAuth2 authentication allows you to use access tokens instead of actual login credentials. This is great for security since the tokens are only valid for specific actions and can be easily revoked once stolen, and they can't cause as much damage as actual account credentials.

However, this extension does not currently support OAuth2 so if you want to use this extension with Gmail or Google Workspace, you must enable [less secure apps](https://support.google.com/accounts/answer/6010255) on your account and use the traditional method described above.
