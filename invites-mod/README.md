# User Invitations

## Summary

Add "invite a friend" functionality to your application. Invite friends using [SendGrid](https://SendGrid.com/) and keep track of your invites with Firestore.

## Details

This Mod defines two callable functions - one to send invitations via email, and the other that will be triggered upon acceptance of an email invitation. **Users must be authenticated for the functions to be triggered.**

This Mod also requires a SendGrid account. They can be created for free at https://SendGrid.com/.

#### Inviting a user
The invite flow begins when an authenticated user enters the email address of the friend they wish to invite. This email is written to an invitations array[1] in Firestore, which triggers the Mod function that sends invitations.

[1] How invitations sent by user are stored in Firestore
```
users:
  12345:
    name: Roman
    invitations:
    - email: foo@gmail.com
```

The invitation email that is sent is defined in the Mod, in `index.js` line 54. The invitation is written in HTML. Feel free to edit this invitation to control what your invitees will see. The default is as follows:
```
<p>Hi there ${email},</p>
<p>I'm using ${APP_NAME} and I'd love for you to join me! <a href="${acceptUrl}">Accept invitation</a></p>
<p>- ${auth.token.name} (via ${APP_NAME})</p>
```

#### Receiving an invitation
The Mod generates an invitation token and uses SendGrid to send an invitation to the given email address, along with a URL token of the form `?invitation=theVeryLongTokenHere`. It stores this generated token in an internal Firestore path[2].

[2] How accept tokens are stored in Firestore
```
invitation_mods_internal:
  tokens:
    theVeryLongTokenHere:
      sender_uid: 12345
      receiver_email: foo@gmail.com
```

When the invitee receives the invitation, they click the link in the invite where they should be redirected to your app. You must authenticate this user. The app is then responsible for grabbing the invitation query string and storing a “accepted tokens” entry in Firestore[3].

[3] How accepted tokens are stored in Firestore
```users:
  87345:
    name: John
    accept_invite_tokens:
    - theVeryLongTokenHere
```

#### Accepting an invitation
The Mod has a function that watches for writes of accepted tokens to Firestore. This functions is triggered, which finalizes the invitation. The function also deletes the `accept_invite_tokens` record for the receivre and the `invitations` record for the sender[4].

[4] How data should look after invite has been accepted
```
users:
  12345:
    name: Roman
    friend_ids:
    - 87345
  87345:
    name: John
    friend_ids:
    - 12345
```

### Configuration

This Mod requires the following environment variables to be set:

- `SENDGRID_API_KEY` is the API key for SendGrid. Once you have created a SendGrid account, you can create an API key by going to "API Keys" under "Settings" and clicking "Create API Key". Alternatively, you can go to "Setup Guide" and follow the instructions under "Integrate using our Web API or SMTP relay".
- `SENDGRID_EMAIL_ALIAS` is the email address invitations will be sent from. We do not support sending from the inviter's personal email address. This can be your domain's email address. You can also create a new email address for the purpose of sending invitations from.
- `APP_NAME` is the name of your app. This is used as part of the invitation email, as well as the subject heading of your email. If you do not wish use the app name in either the invitation email or subject heading, change the "required" field of this environment variable to `false`.
- `ACCEPT_URL_TEMPLATE` is the URL to include in invitation emails. "{token}" will be replaced with the actual invitation token. The default value assumes your app is deployed with Firebase Hosting and expects an 'acceptInvitation' query parameter at the root URL. The default is `https://${PROJECT_ID}.firebaseapp.com/?acceptInvitation={token}`.
- `TARGET_RECEIVER_FIELDS` is the document/array field used when an invitation is accepted. When an invitation is accepted, the mod will add the receiving/accepting user's UID to this field. If the receiver UID is 123 and sender UID is 234, entering "users/{sender}.friends" here will append "123" to the "friends" array field for document "234" in the "users" collection. Separate document/field pairs for this var with commas. The default is `users/{sender}.friends`.
- `TARGET_SENDER_FIELDS` is the document/array field used to save the sending user's UID when an invitation is accepted. If the receiver UID is 123 and sender UID is 234, entering "users/{receiver}.friends" here will append "234" to the "friends" array field for document "123" in the "users" collection. Separate document/field pairs for this var with commas. The default is `users/{receiver}.friends`.
- `METADATA_FIRESTORE_COLLECTION` is a top-level Firestore collection the mod can use to store metadata for invitations. The default is `_invitations`.


### Required Roles

This Mod requires the following IAM roles:

- `firebase.developAdmin` allows access to the Firebase "develop" products. This mod uses this role to write to Firestore.

### Resources Created

This Mod creates two resources:

- a Cloud Function that triggers on new emails written to the invitations array in Firestore.
- a Cloud Function that triggers on new accepted tokens written to Firestore.

### Privacy

This mod stores the environment variables in the source of the Cloud Function.

### Potential Costs

_Disclaimer: without knowing your exact use, it's impossible to say exactly what this may cost._

This mod will generate costs due to:

- **Cloud Functions Usage**: Each time a file is uploaded to the Cloud Storage bucket, a Cloud Function is invoked. If the free quota for Cloud Functions is consumed, then it will generate cost for the Firebase project.
- **Firestore Usage**: Each invocation of the Cloud Function also writes to or reads from Firestore. If the free quota for Firestore is consumed, then it will generate cost for the Firebase project.

See more details at https://firebase.google.com/pricing.

### Copyright

Copyright 2018 Google LLC

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.