# user-referral

**VERSION**: 0.1.0

**DESCRIPTION**: Allow your users to send a pre-populated email (via SendGrid) to invite their friends to use your app. Track invites and conversions using Cloud Firestore.



**CONFIGURATION PARAMETERS:**

* Deployment location: *Where should the mod be deployed? You usually want a location close to your database. For help selecting a location, visit https://firebase.google.com/docs/functions/locations.*

* SendGrid API key: *What is your API key for SendGrid? Create a SendGrid API key: In your SendGrid account, go to "API Keys" under "Settings", then click "Create  API Key". Alternatively, in your SendGrid account, go to "Setup Guide", then follow the instructions to "Integrate using our Web API or SMTP relay".
*

* SendGrid email alias: *What is the email address that you want to use as the alias for sending email invitations? This alias can be your domain's email address, or you can create a new email address for the purpose of sending invitations. We do not support sending invitations using the inviter's personal email address.
*

* App name: *What is the name of your app? This will be used in the invitation email.*

* Accept invitation URL: *What is the URL to include in invitation emails? An example URL is "https://${PROJECT_ID}.firebaseapp.com/?acceptInvitation={token}" The mod replaces "{token}" in the URL with the actual invitation token; the mod generates this token when triggered. Note that the default URL for this mod assumes your app uses Firebase Hosting, so the URL uses `acceptInvitation` as a query parameter at the root URL.
*

* Document and field path for invited-user's UID: *What is the path to the Cloud Firestore document and field where you want to store the UID of users who *receive* invitations? For example, if the invitation receiver's UID is 123 and the sender's UID is 789, a specified path and field of `users/{sender}.friends` will append "123" to the "friends" array field for document "789" in the "users" collection. Document/field pairs are separated with commas.
*

* Document and field path for sending-user's UID: *What is the path to the Cloud Firestore document and field where you want to store the UID of users who *send* invitations? For example, if the invitation receiver's UID is 123 and the sender's UID is 789, a specified path and field of `users/{receiver}.friends` will append "789" to the "friends" array field for document "123" in the "users" collection. Document/field pairs are separated with commas.
*

* Cloud Firestore collection for metadata: *What is the path for the Cloud Firestore collection where you want to store metadata for invitations?
*



**CLOUD FUNCTIONS CREATED:**

* sendInvitation (HTTPS)

* acceptInvitation (HTTPS)



**DETAILS**: Use this mod to add "invite a friend" functionality so that your users can send invite emails to other people who aren't yet using your app.

This mod creates two callable functions - one that sends invitations via email and another that's triggered by the acceptance of an email invitiation (a conversion).

This mod sends emails using a required [SendGrid](https://SendGrid.com/) account, and keeps track of invites and conversions using Cloud Firestore.



**ACCESS REQUIRED**:



This mod will operate with the following project IAM roles:

* datastore.user (Reason: Allows the mod to store metadata about invitations in Cloud Firestore.)
