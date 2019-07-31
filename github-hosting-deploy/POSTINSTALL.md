### Using the mod

To start using this installed mod, you need to first add your webhook address (`${function:deploy.url}`) into your repositories settings, as detailed below:

1.  Go to the GitHub repository, click **Settings**, then click **Webhooks** (which brings you to something like `https://github.com/bkendall/my-website/settings/hooks`).

1.  Click **Add webhook**, then configure the following:
      + **Payload URL** is `${function:deploy.url}`.
      + **Content type** must be _application/json_.
      + **Secret** must remain empty.
      + **Just the `push` event** is a sufficient trigger for this mod.

1.  Make sure the **Active** checkbox is selected.

1.  Click **Add webhook**.

You can now verify the webhook in one of two ways:

1.  Go to the GitHub repository, click **Settings**, then click **Webhooks**.

1.  Review the _Recent Deliveries_ section. There should be one or more entries with a green checkmark indicating a successful call to the webhook.

1.  Open the Firebase console, then go to the Functions dashboard. From there, you can go into the _Logs_ tab to check that there is one or more calls made to your webhook by GitHub.

### See it in action

Give this mod a try by making a commit to the `${param:BRANCH}` branch, push it to GitHub, then watch the Firebase Hosting dashboard and your browser update!

### Monitoring

As a best practice, you can [monitor the activity](https://firebase.google.com/docs/mods/manage-installed-mods#monitor) of your installed mod, including checks on its health, usage, and logs.
