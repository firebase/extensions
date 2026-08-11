## Enable PITR in the Google Cloud Console

Follow the guidelines here [here](https://firebase.google.com/docs/firestore/use-pitr#gcloud) to enable PITR on your current database.

## Creating a secondary Firestore database

```bash
   gcloud alpha firestore databases create --database=DATABASE_ID --location=LOCATION --type=firestore-native --project=${param:PROJECT_ID}
```

More information on this can be found [here](https://cloud.google.com/sdk/gcloud/reference/alpha/firestore/databases/create)

## Building the Dataflow Flex Template

Before this extension can run restoration jobs from BigQuery to Firestore, you must build the Dataflow Flex Template. This is a one-time process that you must perform before you can use the extension.

We have detailed the steps below, or there is a single script you can run which will perform all the steps for you [here](https://github.com/GoogleCloudPlatform/firebase-extensions/blob/main/firestore-incremental-capture/install/run.sh).

1. Find your extensions's service account email:

   ```bash
   gcloud iam service-accounts list --format="value(EMAIL)" --filter="displayName='Firebase Extensions ${param:EXT_INSTANCE_ID} service account' AND DISABLED=False" --project="${param:PROJECT_ID}"
   ```

   You can also do this through the console, by navigating to https://console.cloud.google.com/iam-admin/serviceaccounts?authuser=0&project=${param:PROJECT_ID}

2. [Configure the Artificat Registery](https://cloud.google.com/dataflow/docs/guides/templates/using-flex-templates?hl=en#configure):

```bash
  gcloud artifacts repositories create ${param:EXT_INSTANCE_ID} \
  --repository-format=docker \
  --location=${param:LOCATION} \
  --project=${param:PROJECT_ID} \
  --async
```

Configure Docker to authenticate requests for Artifact Registry:

```bash
gcloud auth configure-docker ${param:LOCATION}-docker.pkg.dev
```

3. Add required policy binding for the repository:

```bash
  gcloud artifacts repositories add-iam-policy-binding ${param:EXT_INSTANCE_ID} \
  --location=${param:LOCATION} \
  --project=${param:PROJECT_ID} \
  --member=serviceAccount:SERVICE_ACCOUNT_EMAIL \
  --role=roles/artifactregistry.writer
```

4. Add the required role for the extension service account to trigger Dataflow:

   ```bash
    gcloud projects add-iam-policy-binding ${param:PROJECT_ID} \
    --project ${param:PROJECT_ID} \
    --member=serviceAccount:SA_EMAIL \
    --role=roles/dataflow.developer
   ```

5. Add the required role for the extension service account to trigger Dataflow:

   ```bash
    gcloud projects add-iam-policy-binding ${param:PROJECT_ID} \
    --project ${param:PROJECT_ID} \
    --member=serviceAccount:SA_EMAIL \
    --role=roles/iam.serviceAccountUser
   ```

6. Add the required role for the extension service account to trigger Dataflow:

   ```bash
    gcloud projects add-iam-policy-binding ${param:PROJECT_ID} \
    --project ${param:PROJECT_ID} \
    --member=serviceAccount:SA_EMAIL \
    --role=roles/artifactregistry.writer
   ```

7. Download the JAR file for the Dataflow Flex Template [here](https://github.com/GoogleCloudPlatform/firebase-extensions/tree/main/firestore-incremental-capture-pipeline/target/restore-firestore.jar).
8. Run the following command to build the Dataflow Flex Template. Note that Cloud Storage buckets provisioned after September 30th 2024 are suffixed by `.firebasestorage.app` rather than `.appspot.com` and you should change the following command accordingly:

```bash
  gcloud dataflow flex-template build gs://${param:PROJECT_ID}.appspot.com/${param:EXT_INSTANCE_ID}-dataflow-restore \
    --image-gcr-path ${param:LOCATION}-docker.pkg.dev/${param:PROJECT_ID}/${param:EXT_INSTANCE_ID}/dataflow/restore:latest \
    --sdk-language JAVA \
    --flex-template-base-image JAVA11 \
    --jar /path/to/restore-firestore.jar \
    --env FLEX_TEMPLATE_JAVA_MAIN_CLASS="com.pipeline.RestorationPipeline" \
    --project ${param:PROJECT_ID}
```

## Triggering a restoration job

You can trigger a restoration job by calling the `restoreFirestore` function [here](https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/${EXT_INSTANCE_ID}).

Here is an example that will run from one hour ago:

```bash
curl -m 70 -X POST https://us-central1-${PROJECT_ID}.cloudfunctions.net/ext-firestore-incremental-capture-onHttpRunRestoration \
-H "Authorization: bearer $(gcloud auth print-identity-token)" \
-H "Content-Type: application/json" \
-d "{\"timestamp\":$(date -u -v-1H +%s)}"
```
