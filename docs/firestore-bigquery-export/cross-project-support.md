# Cross-Project Support

If you specified an `BIGQUERY_PROJECT_ID` parameter during configuration of the extension, BigQuery will sync data to tables and views in the defined GCP project.

## Example Scenario

A typical scenario for this would be to install multiple instances of the extension to share the data across multiple (separate) instances without having to support multiple Firestore instances.

## Additional Setup

When defining a specific BigQuery project ID, a manual step to set up permissions is required:

1. Navigate to https://console.cloud.google.com/iam-admin/iam?project=${param:BIGQUERY_PROJECT_ID}
2. Add the **BigQuery Data Editor** role to the following service account:
   `ext-${param:EXT_INSTANCE_ID}@${param:PROJECT_ID}.iam.gserviceaccount.com`.
