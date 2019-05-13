This Mod contains a few parts to quickly set up automated deployment of a static website from a git repository to Firebase Hosting.

This Mod creates one resource: a HTTP-triggered function that responds to GitHub webhooks. It is provided at the end of the installation process and looks like `https://us-central1-my-project.cloudfunctions.net/mod-hosting-deploy-b33f-deploy`. This will be used to configure a webhook on GitHub.

In order to start using the installed Mod, the webhook address (see Resources Created above) will need to be added into your repositories settings. This can be done in the following manner (specific instructions following our continued example):

1. Go to the repository on GitHub and click on "Settings", then "Webhooks" (which brings you to something like `https://github.com/bkendall/my-website/settings/hooks`).
2. Add a new Webhook (click "Add webhook").
3. The "Payload URL" is the URL provided at the end of the installation process (see above). Copy it as-is from the terminal into the form.
4. "Content type" needs to be set to "application/json".
5. "Secret" remains empty.
6. "Just the `push` event" is a sufficient trigger for this Mod.
7. Make sure the "Active" checkbox is checked.
8. Click "Add webhook".

The webhook can then be verified in one of two ways:

1. Open the webhook's settings and look at the "Recent Deliveries" section. There should be one or more entries there with a green checkmark indicating a successful call to the webhook.
2. Open the Firebase Console and go into the Functions dashboard. From there, you can go into the Logs tab and see that there is one or more calls made to your webhook by GitHub.

Finally, now that it's hooked up, we can make a change in our repository and see the Mod work.

1. In the repository, make an update to `public/index.html`. Commit and push the change to GitHub.
2. After a moment, check the Firebase Hosting website for the change (our example would be `https://my-project.firebaseapp.com`). The committed changes should appear in the browser.
