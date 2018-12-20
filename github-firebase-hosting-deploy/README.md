# Continuous Firebase Hosting Deployment

## Summary

Deploys a specified folder from publicly-accessible git repository to Firebase Hosting, triggered by a webhook.

## Details

This Mod contains a few parts to quickly set up automated deployment of a static website from a git repository to Firebase Hosting. In this example below, we're going to assume that the repository is hosted on GitHub and is named `my-website`. Our Firebase project is going to be called `my-project`.

### Repository Background

In order for the Mod to know what to deploy, we need to be able to specify a folder in our repository. Our example `my-website` repository will have the following structure:

- /
  - public/
    - index.html
    - about.html
  - README.md

### Configuration

This Mod requires 4 variables to correctly run:

- `SITE_NAME` is the name of the Firebase Hosting site to which we will deploy. If you only have one site in your Project, as we will in this example, it will be the same as your Project name (`my-website`). If you have multiple Firebase Hosting sites in your Project (see the [Firebase multiple sites documentation](https://firebase.google.com/docs/hosting/multisites)), you will need to specify which site (which can be found as the title of a card on the Firebase Hosting dashboard).
- `REPO` is the location of the publicly-accessible repository we are going to be using. Since we have a public repository on GitHub, we can provide the direct url. For example: `https://github.com/bkendall/my-website`.
- `BRANCH` is the branch that we want to deploy. This Mod will only deploy this branch in response to pushes on this branch.
- `DEPLOY_ROOT` is the path to the folder that we want to deploy. In our case, we will use the `public` folder.

### Required Roles

Since this Mod needs to be able to update a Firebase Hosting site, it has been specified with the `firebase.developAdmin` role.

### Resources Created

This Mod creates one resource: a HTTP-triggered function that responds to GitHub webhooks. It is provided at the end of the installation process and looks like `https://us-central1-my-project.cloudfunctions.net/mod-hosting-deploy-b33f-deploy`. This will be used to configure a webhook on GitHub.

### Post-install Actions

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

### Triggering the Mod

Finally, now that it's hooked up, we can make a change in our repository and see the Mod work.

1. In the repository, make an update to `public/index.html`. Commit and push the change to GitHub.
2. After a moment, check the Firebase Hosting website for the change (our example would be `https://my-project.firebaseapp.com`). The committed changes should appear in the browser.

### Troubleshooting

If there is a suspected issue, re-verify the Mod is correctly set up and hooked up (including it being added to GitHub). Checking the various logs (as described in "Post-install Actions") can help reveal issues as well.

### Privacy

This Mod requires knowledge of your publicly-accessible repository as well as the name of the site to which you are deploying. The Mod only clones the repository in order to send appropriate files to Firebase Hosting but does not read or make any altercations to the repository. The actions the Mod takes on the files is no different than the Firebase CLI (hashing and uploading).

### Potential Costs

_Disclaimer: without knowing your exact use, it's impossible to say exactly what this may cost._

In this example usage, this Mod is unlikely going to generate significant billing usage on your project. The few variables that would change this are:

- very frequent calls to the webhook which causes the function to be run a huge number of times. Pushes to GitHub cause this function to be executed; pushes to branches other than `BRANCH` as configured (see above) will be very quickly terminated. However, if there is a _large_ amount of activity on the repository, that could cause the function to start accumulating charges once it passes the free quota.
- large amounts of traffic on the deployed website will incur bandwidth costs.
- large amounts of data in the `DEPLOY_ROOT` folder that is deployed to Firebase Hosting will incur storage costs.

You can find more detailed pricing information at https://firebase.google.com/pricing.

### Copyright

Copyright 2018 Google LLC

Use of this source code is governed by an MIT-style
license that can be found in the LICENSE file or at
https://opensource.org/licenses/MIT.
