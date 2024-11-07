# Observability Guide for Firestore BigQuery Export Extension

This guide provides instructions on how to monitor and check logs for the **firestore-bigquery-export** Firebase Extension for versions `>=0.1.56`. Monitoring your extension's logs is essential for debugging, understanding its behavior, and ensuring it operates as expected.

## Table of Contents

- [Overview](#overview)
- [Identifying Extension Functions](#identifying-extension-functions)
- [Viewing Logs in the Firebase Console](#viewing-logs-in-the-firebase-console)
- [Viewing Logs in the Google Cloud Console](#viewing-logs-in-the-google-cloud-console)
  - [Using Cloud Functions Logs](#using-cloud-functions-logs)
  - [Using Logs Explorer](#using-logs-explorer)
- [Understanding Log Entries](#understanding-log-entries)
- [Filtering Logs with Queries](#filtering-logs-with-queries)
- [Common Log Messages and Troubleshooting](#common-log-messages-and-troubleshooting)
- [Additional Resources](#additional-resources)

## Overview

The `firestore-bigquery-export` extension listens to changes in your specified Firestore collection and exports them to BigQuery. It consists of Cloud Functions that handle these events and write data to BigQuery. Monitoring the logs of these functions helps you ensure the data is being exported correctly and troubleshoot any issues that may arise.

## Identifying Extension Functions

When the extension is installed, it deploys several Cloud Functions. The primary functions related to data export are:

- **OnWrite Function**: Handles Firestore `onWrite` events to synchronize data with BigQuery

  - **Function Name Format**: `ext-<EXTENSION_INSTANCE_ID>-fsexportbigquery`

- **OnDispatch Function**: Handles tasks dispatched to synchronize data with BigQuery if the initial onWrite attempts fail.
  - **Function Name Format**: `ext-<EXTENSION_INSTANCE_ID>-syncBigQuery`

Replace `<EXTENSION_INSTANCE_ID>` with the instance ID of your installed extension.

For example, if your extension instance ID is `firestore-bigquery-export`, your functions will be named:

- `ext-firestore-bigquery-export-fsexportbigquery`
- `ext-firestore-bigquery-export-syncBigQuery`

## Viewing Logs in the Firebase Console

1. Navigate to the [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. In the left navigation menu, click on **Extensions**
4. Find your instance of the Firestore BigQuery Export extension
5. Click on **View logs** to see the logs specifically for your extension instance

## Viewing Logs in the Google Cloud Console

### Using Cloud Run Functions Logs

1. Navigate to the [Google Cloud Console](https://console.cloud.google.com/)
2. Ensure your project is selected at the top
3. Go to **Cloud Run Functions** by clicking on **Navigation Menu** (☰) > **Cloud Functions**
4. In the list of functions, find your extension's functions:
   - `ext-<EXTENSION_INSTANCE_ID>-fsexportbigquery`
   - `ext-<EXTENSION_INSTANCE_ID>-syncBigQuery`
5. Click on the function name to view its details
6. In the function details page, click on the **Logs** tab
7. You will see logs specific to that function

### Using Logs Explorer

For more advanced log querying and analysis, use the **Logs Explorer**:

1. In the Google Cloud Console, click on **Navigation Menu** (☰) > **Logging** > **Logs Explorer**
2. Use the following steps to filter logs for your extension

#### Filtering by Function Name and Searching for Firestore event logs from extension

For the fsexportbigquery function (onWrite events):

```plaintext
(resource.type="cloud_function" resource.labels.function_name=("ext-firestore-bigquery-export-fsexportbigquery") resource.labels.region="us-central1") OR (resource.type="cloud_run_revision" resource.labels.service_name=("ext-firestore-bigquery-export-fsexportbigquery") resource.labels.location="us-central1") SEARCH("Firestore event received by onWrite trigger")
```

For the syncBigQuery function (onDispatch events):

```plaintext
(resource.type="cloud_function" resource.labels.function_name=("ext-firestore-bigquery-export-syncBigQuery") resource.labels.region="us-central1") OR (resource.type="cloud_run_revision" resource.labels.service_name=("ext-firestore-bigquery-export-syncBigQuery") resource.labels.location="us-central1") SEARCH("Firestore event received by onDispatch trigger")
```

Replace `firestore-bigquery-export` with your extension instance ID. These queries will show logs from both traditional Cloud Functions and Cloud Run deployments for each respective function.

## Understanding Log Entries

The extension uses structured logging to provide detailed information about its operation. Here's an example of a log entry from the onWrite trigger:

```json
{
  "insertId": "672ca19d0008f1be9873dda5",
  "jsonPayload": {
    "document_name": "projects/dev-extensions-testing/databases/(default)/documents/posts/x0F2QodvO09MJGX3DUfm",
    "event_id": "1b8f5ae5-983a-40f6-b921-560118e5e321-1",
    "message": "Firestore event received by onWrite trigger",
    "operation": 0
  },
  "labels": {},
  "logName": "projects/dev-extensions-testing/logs/cloudfunctions.googleapis.com%2Fcloud-functions",
  "receiveTimestamp": "2024-11-07T11:16:45.817442537Z",
  "resource": {},
  "severity": "INFO",
  "timestamp": "2024-11-07T11:16:45.586174Z",
  "trace": "projects/dev-extensions-testing/traces/6b1e13de24821178b8937f6ed72cc113"
}
```

Similarly, here's an example log entry from the onDispatch trigger:

```json
{
  "insertId": "672ca19d0008f1be9873dda6",
  "jsonPayload": {
    "document_name": "projects/dev-extensions-testing/databases/(default)/documents/posts/x0F2QodvO09MJGX3DUfm",
    "event_id": "1b8f5ae5-983a-40f6-b921-560118e5e321-2",
    "message": "Firestore event received by onDispatch trigger",
    "operation": 0
  },
  "labels": {},
  "logName": "projects/dev-extensions-testing/logs/cloudfunctions.googleapis.com%2Fcloud-functions",
  "receiveTimestamp": "2024-11-07T11:17:45.817442537Z",
  "resource": {},
  "severity": "INFO",
  "timestamp": "2024-11-07T11:17:45.586174Z",
  "trace": "projects/dev-extensions-testing/traces/6b1e13de24821178b8937f6ed72cc113"
}
```

Key fields to note:

- `insertId`: A unique identifier for the log entry
- `jsonPayload`: Contains the structured data of the log entry, including:
  - `document_name`: The Firestore document path
  - `event_id`: The unique event ID
  - `message`: The log message indicating which trigger received the event
  - `operation`: The type of change that occurred (0 = CREATE, 1 = DELETE, 2 = UPDATE, 3 = IMPORT). This corresponds to the `ChangeType` enum in the extension's code.
- `logName`: The full path of the log in Cloud Logging
- `receiveTimestamp`: When the log was received by Cloud Logging
- `timestamp`: When the event occurred
- `trace`: A unique identifier for tracing the request through the system

## Filtering Logs with Queries

To effectively monitor and troubleshoot, you can use queries in the Logs Explorer to filter logs.

### Filtering by Severity

To view only error logs:

```plaintext
severity="ERROR"
```

### Filtering by Operation Type

To filter logs for a specific operation, such as UPDATE:

```plaintext
jsonPayload.operation=2
```

### Filtering by Log Messages

To find logs related to events received by the onDispatch trigger:

```plaintext
jsonPayload.message="Firestore event received by onDispatch trigger"
```

### Combining Filters

You can combine filters using AND and OR.

Example:

```plaintext
resource.labels.function_name="ext-<EXTENSION_INSTANCE_ID>-syncBigQuery"
AND jsonPayload.message="Firestore event received by onDispatch trigger"
```

This query shows logs from the syncBigQuery function where Firestore events were received by the onDispatch trigger.

## Common Log Messages and Troubleshooting

### "Firestore event received by onWrite trigger"

**Description**: Indicates that the `fsexportbigquery` function received a Firestore event via the onWrite trigger. This is a normal informational message.

**Action**: No action needed if everything is working as expected.

### "Firestore event received by onDispatch trigger"

**Description**: Indicates that the `syncBigQuery` function received a task dispatched via the onDispatch trigger to synchronize data with BigQuery.

**Action**: No action needed if everything is working as expected.

### "Failed to write event to BigQuery"

**Description**: An error occurred when attempting to write data to BigQuery.

**Possible Causes**:

- BigQuery dataset or table does not exist
- Insufficient permissions
- Data schema mismatch

**Troubleshooting Steps**:

1. Check BigQuery Dataset and Table:

   - Ensure that the dataset and table specified in your extension configuration exist
   - If they do not exist, verify that the extension has the permissions to create them

2. Verify Permissions:

   - The service account running the Cloud Function must have the BigQuery Data Editor role
   - Check IAM permissions in the Google Cloud Console

3. Check Data Schema:
   - Ensure that the data being written matches the schema of the BigQuery table
   - Look for any changes in Firestore data that might affect the schema

### "Error when mirroring data to BigQuery"

**Description**: A general error occurred during the data export process.

**Troubleshooting Steps**:

1. Review the Error Details:

   - Expand the log entry to view the error stack trace and message
   - Identify any specific error codes or messages

2. Inspect Firestore Data:

   - Check the Firestore document that caused the error for any anomalies
   - Ensure data types and structures are consistent

3. Check Extension Configuration:
   - Verify that all configuration parameters are correct
   - Ensure that any transformation functions are working properly
