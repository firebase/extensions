# crashlytics-gitlab

**VERSION**: 0.1.0

**DESCRIPTION**: Automatically create Crashlytics issues in GitLab anytime a Crashlytics report is generated or an issue is created. (Requires a Gitlab account.)



**CONFIGURATION PARAMETERS:**

* Deployment Location: *Where should the mod be deployed? Pick a location that is close to your Firestore database. See https://firebase.google.com/docs/functions/locations#selecting_regions_for_firestore_and_storage.*

* GitLab URL: *What is the URL of your GitLab instance?
*

* GitLab Project ID: *What is the ID of your GitLab project?
*

* GitLab Access Token: *Please paste your access token obtained from your GitLab instance. From Setting, click on "Access tokens" and generate a new Personal Access Token.
*



**CLOUD FUNCTIONS CREATED:**

* crashlyticsgitlabnew (providers/firebase.crashlytics/eventTypes/issue.new)

* crashlyticsgitlabregression (providers/firebase.crashlytics/eventTypes/issue.regressed)

* crashlyticsgitlabvelocityalert (providers/firebase.crashlytics/eventTypes/issue.velocityAlert)



**DETAILS**: The Mod will automatically create issues in GitLab when Crashlytics reports a new issue, a regression or a velocity alert.

When installing the mod, you will need information about your GitLab instance as well as a personal access token to allow the mod to create issues within GitLab.
