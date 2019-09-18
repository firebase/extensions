# hosting-deploy-github

**VERSION**: 0.1.1

**DESCRIPTION**: Deploys assets in a specified GitHub directory to Firebase Hosting whenever a commit is made to a specified branch.



**CONFIGURATION PARAMETERS:**

* Deployment location: Where should the extension be deployed? For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* GitHub repository: What is the full URL of the GitHub repository from which you want to deploy? For example: `https://github.com/firebase/firebase-tools`

* Deployment branch: Which branch in your GitHub repository do you want to use for triggering deploys to Firebase Hosting?

* Deployment root: Which directory in your GitHub repository contains the assets to be deployed to Firebase Hosting?

* Site name: What is the name of your site? If your Firebase project only has one site, your site name is usually the same as your project ID. View your [available site names](https://console.firebase.google.com/project/${PROJECT_ID}/hosting/main).



**CLOUD FUNCTIONS CREATED:**

* deploy (HTTPS)



**DETAILS**: Use this extension to set up automated deployments of a static website from a git repository to Firebase Hosting.

This extension creates one resource: an HTTPS-triggered function that responds to GitHub webhooks. It's provided at the end of this extension's installation process and looks like `https://us-central1-my-project.cloudfunctions.net/mod-hosting-deploy-b33f-deploy`. You'll use this URL to configure a webhook on GitHub.

To start using this installed extension, you need to first add your webhook address into your repositories settings, as detailed below:

1.  Go to the GitHub repository, click **Settings**, then click **Webhooks** (which brings you to something like `https://github.com/bkendall/my-website/settings/hooks`).
1.  Click **Add webhook**, then configure the following:
      + **Payload URL** is the URL provided at the end of the installation of the extension
        process (see above).
      + **Content type** must be _application/json_.
      + **Secret** must remain empty.
      + **Just the `push` event** is a sufficient trigger for this extension.
1.  Make sure the **Active** checkbox is selected.
1.  Click **Add webhook**.

You can now verify the webhook in one of two ways:

1.  Go to the GitHub repository, click **Settings**, then click **Webhooks**.
1.  Review the _Recent Deliveries_ section. There should be one or more entries with a green checkmark indicating a successful call to the webhook.
1.  Open the Firebase console, then go to the functions dashboard. From there, you can go into the _Logs_ tab to check that there is one or more calls made to your webhook by GitHub.

When everything is configured and hooked up, you can make a change in your repository and see this extension work.

1.  In the GitHub repository, make an update to `public/index.html`.
1.  Commit then push the change to GitHub.
1.  After a moment, check the Firebase Hosting dashboard in the Firebase console for the change (for this example, `https://my-project.firebaseapp.com`). The committed changes should appear in your browser.

When you use Firebase Extensions, you're only charged for the underlying resources that you use. Firebase Extensions themselves are free to use. All Firebase services offer a free tier of usage. [Learn more about Firebase billing.](https://firebase.google.com/pricing)



**APIS USED**:

* firebasehosting.googleapis.com (Reason: Required to deploy to Firebase Hosting)



**ACCESS REQUIRED**:



This extension will operate with the following project IAM roles:

* firebase.admin (Reason: Allows the extension to deploy to Firebase Hosting. This extension will only interact with Firebase Hosting and Cloud Functions.)
