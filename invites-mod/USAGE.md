Congrats on setting up the Invitations mod!

# Setting up your Android/iOS/web client

The client-side API for this mod is just a set of **callable functions.**

Read [the docs on callable
functions](https://firebase.google.com/docs/functions/callable#set_up_your_client_development_environment)
for details on how to call functions from Android, iOS, or web.

# Sending invitations

To send an invitation, authenticate the user with Firebase Authentication, and call the `sendInvitation` function with the email address to invite.

Your `sendInvitation` function can be accessed at **\${FUNCTION_URL_SENDINVITATION}**.

To call it in your application, use: **\${MOD_INSTANCE_ID}-sendInvitation**.
Here is a web sample of how to use it:

```
    firebase.functions().httpsCallable('${MOD_INSTANCE_ID}-sendInvitation')({email: 'friendtoinvite@gmail.com'});
```

# Accepting invitations

The invitation email that gets sent will include an invitation
token in the query string, as specified during mod configuration.

If the receiver clicks this link, you should authenticate them, and once authenticated, your client should read this value and pass it to the `acceptInvitation` function.

Your `acceptInvitation` function can be accessed at **\${FUNCTION_URL_ACCEPTINVITATION}**

To call it in your application, use: **\${MOD_INSTANCE_ID}-acceptInvitation**.
Here is a web sample of how to use it:

```
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        let [_, token] = window.location.search.match(/acceptInvitation=([^&]+)/);
        if (token) {
          firebase.functions().httpsCallable('${MOD_INSTANCE_ID}-acceptInvitation')({token});
        }
      } else {
        // authenticate the user here!
      }
    });
```
