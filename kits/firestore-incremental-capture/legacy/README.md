# Firestore Incremental Backup Stream

**Author**: Google Cloud (**[https://cloud.google.com/](https://cloud.google.com/)**)

**Description**: Offers a cost-effective, flexible disaster recovery mechanism for Firestore.



**Details**: This extension provides an automated, incremental backup solution that extends native Firestore capabilities. Generally, you should consider [Firestore’s native Point in Time Recovery](https://firebase.google.com/docs/firestore/use-pitr) and [Scheduled Backups](https://cloud.google.com/firestore/docs/backups) solutions as a first option. However, if those features don’t meet your needs, this extension can be a more flexible alternative.

This extension provides an automated, incremental backup solution that extends native Firestore capabilities. Generally, you should consider Firestore’s native Point in Time Recovery and Scheduled Backups solution as a first option. However, if those features don’t meet your needs, this extension can be a more flexible alternative.

With this extension, you can capture and retain incremental changes in Firestore for up to 30 days or more, allowing for point-in-time recovery well beyond the default 7-day window.

The extension captures changes on every Firestore write and stores the change incrementally in BigQuery. This data capture mechanism ensures a complete history is maintained, enabling recovery to any point within the configured backup period.

You can choose to incrementally capture a single collection, a collection group using wildcards, or an entire Firestore database.

The extension also provides a Dataflow connector that can incrementally restore data from BigQuery to Firestore. Installation is done through a simple script that needs to be executed by you, and instructions to do this are provided upon installation. After installation, triggering the restoration is as simple as calling a Cloud Function.

This extension is subject to [BigQuery write throughput limitations and availability limitations](https://cloud.google.com/bigquery/quotas), as well as [Cloud Functions at-least-once delivery guarantee](https://cloud.google.com/functions/docs/concepts/execution-environment). Since data is mirrored into BigQuery through Cloud Events, it is recommended to restore to timestamp prior to the current time to prevent missing data.

## Additional Setup

Before this extension can run restoration jobs from BigQuery to Firestore, you’ll need to:

- [Set up Cloud Firestore in your Firebase project](https://firebase.google.com/docs/firestore/quickstart).
- [Enable PiTR in your Firestore database instance](https://firebase.google.com/docs/firestore/use-pitr)
- Ensure that a separate Firestore instance exists. A valid database must exist for the restoration to backup to. Ensure that a separate Firestore instance exists If one does not exist, you can create one with the following script:

```bash
    gcloud alpha firestore databases create \
    --database=DATABASE_ID \
    --location=LOCATION \
    --type=firestore-native \
    --project=PROJECT_ID
```

(Note that this extension currently only works on database instances in `firestore-native` mode).

Further instructions are provided upon installation.

### Billing

To install an extension, your project must be on the Blaze (pay as you go) plan. You will be charged a small amount (typically around $0.01/month) for the Firebase resources required by this extension (even if it is not used).
This extension uses other Firebase and Google Cloud Platform services, which have associated charges if you exceed the service's no-cost tier:

- Dataflow
- BigQuery
- Artifact Registry
- Cloud EventArc
- Cloud Functions (See [FAQs](https://firebase.google.com/support/faq#extensions-pricing))

[Learn more about Firebase billing](https://firebase.google.com/pricing).

### Additional Uninstall Steps

> ⚠️ The extension does not delete various resources automatically on uninstall.

After you have uninstalled this extension, you will be required to remove the dataflow pipeline which was set up. You can do this through the
Google Cloud Console [here](https://console.cloud.google.com/dataflow/pipelines). This extension will also create artifacts stored in the Artifact Registry, which you can also manage from the console [here](https://console.cloud.google.com/artifacts).




**Configuration Parameters:**

* Cloud Functions location: Where do you want to deploy the functions created for this extension? You usually want a location close to your database. For help selecting a location, refer to the [location selection guide](https://firebase.google.com/docs/functions/locations).

* Collection path: What is the path to the collection that contains the strings that you want to capture all changes of? Use `{document=**}` to capture all collections.


* Bigquery dataset Id: The id of the Bigquery dataset to sync data to.


* Bigquery table Id: The id of the Bigquery table to sync data to.


* Backup instance Id: The name of the Firestore instance to backup the database to.




**Cloud Functions:**

* **runInitialSetup:** Creates the backup BigQuery database if it does not exist

* **syncData:** Enqueues a task to sync data to BigQuery

* **syncDataTask:** Distributed cloud task for syncing data to BigQuery

* **onHttpRunRestoration:** Starts a new restoration task

* **onBackupRestore:** Exports data from storage to a pre-defined Firestore instance.



**APIs Used**:

* eventarc.googleapis.com (Reason: Powers all events and triggers)

* bigquery.googleapis.com (Reason: Running queries)

* dataflow.googleapis.com (Reason: Running dataflow jobs)



**Access Required**:



This extension will operate with the following project IAM roles:

* datastore.user (Reason: Allows the extension to write updates to the database.)

* bigquery.dataEditor (Reason: Allows the creation of BQ jobs to import Firestore backups.)
