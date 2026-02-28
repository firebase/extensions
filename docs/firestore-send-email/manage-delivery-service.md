# Manage delivery status

## Manage delivery status with the Trigger Email from Firestore extension

When a document is added to the collection, the extension picks it up for email delivery processing. The extension creates and updates a `delivery` field in the document as it processes the email.

## Email delivery processing

The `delivery` field can be populated with the following fields:

- **state:** One of `PENDING`, `PROCESSING`, `SUCCESS`, or `ERROR`.
- **startTime:** Timestamp when email processing began.
- **endTime:** Timestamp when email processing is completed (that is, ended in either a `SUCCESS` or `ERROR` state).
- **error:** If there was an email delivery error, an error message will be populated here.
- **attempts:** Number of delivery attempts for this email.
- **leaseExpireTime:** In case of a hang or timeout, the time at which a `PROCESSING` state should be considered an error.
- **info:** After successful email delivery (to at least one address), this field will be populated with the following fields:
  - **messageId:** The message ID of the delivered email.
  - **accepted:** Array of email addresses to which the email was successfully delivered.
  - **rejected:** Array of email addresses to which the email could not be delivered.
  - **pending:** Array of email addresses that were temporarily rejected by SMTP.
  - **response:** The last response from the SMTP server.

An email will typically go from `PENDING` to `PROCESSING` to either `SUCCESS` or `ERROR`. Once in the `SUCCESS` or `ERROR` state, additional changes to the document will not trigger the extension to send another email. To resend an email with document updates, you can change the `state` to `PENDING` or `RETRY`.

## Manual retries

There are instances in which email delivery fails in a recoverable fashion or the document can be manually corrected for proper delivery with minor modifications. While retries are not automatic, you can manually change the `state` in the `delivery` field to `RETRY` so that the extension attempts email delivery again (and increments the number of `attempts`).
