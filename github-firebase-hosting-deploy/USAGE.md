In order to start using the installed Mod, the webhook address `${FUNCTION_URL_DEPLOY}` will need to be added into your repositories settings. This can be done in the following manner:

1. Go to the repository on GitHub and click on "Settings", then "Webhooks".
2. Add a new Webhook (click "Add webhook").
3. The "Payload URL" is the URL provided at the end of the installation process (see above). Copy it as-is from into the form.
4. "Content type" needs to be set to "application/json".
5. "Secret" remains empty.
6. "Just the `push` event" is a sufficient trigger for this Mod.
7. Make sure the "Active" checkbox is checked.
8. Click "Add webhook".

The webhook can then be verified in one of two ways:

1. Open the webhook's settings and look at the "Recent Deliveries" section. There should be one or more entries there with a green checkmark indicating a successful call to the webhook.
2. Open the Firebase Console and go into the Functions dashboard. From there, you can go into the Logs tab and see that there is one or more calls made to your webhook by GitHub.

Finally, make a commit to the specified `BRANCH`, push it to GitHub, and see the Firebase Hosting site be updated!
