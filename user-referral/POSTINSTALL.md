This mod defines two callable functions - one that sends invitations via email and another that's triggered by the acceptance of an email invitation.

### Set up your iOS/Android/Web client

The client-side API for this mod is a set of callable functions.

Learn how to call functions from iOS, Android, or Web clients in the [callable functions documentation](https://firebase.google.com/docs/functions/callable#set_up_your_client_development_environment).

### Send invitations

To send an invitation, authenticate the user with Firebase Authentication, then call the `sendInvitation` function with the email address of the person to invite.

Your `sendInvitation` function can be accessed at **\${function:sendInvitation.url}**.

To call this function in your application, use: **\${param:MOD_INSTANCE_ID}-sendInvitation**.

Here is a web sample of how to use this function:

```
    firebase.functions().httpsCallable('${param:MOD_INSTANCE_ID}-sendInvitation')({email: 'friendtoinvite@gmail.com'});
```

### Accept invited users

The invitation email will include an invitation token in the query string, as specified during mod configuration.

If the receiver clicks this link, you should authenticate them with Firebase Authentication. Then, once authenticated, your client should read this value then pass it to the `acceptInvitation` function.

Your `acceptInvitation` function can be accessed at **\${function:acceptInvitation.url}**.

To call this function in your application, use: **\${param:MOD_INSTANCE_ID}-acceptInvitation**.

Here is a web sample of how to use this function:

```
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        let [_, token] = window.location.search.match(/acceptInvitation=([^&]+)/);
        if (token) {
          firebase.functions().httpsCallable('${param:MOD_INSTANCE_ID}-acceptInvitation')({token});
        }
      } else {
        // authenticate the user here!
      }
    });
```

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/mods/manage-installed-mods#monitor) of your installed mod, including checks on its health, usage, and logs.
