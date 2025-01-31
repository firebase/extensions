#!/bin/bash

# Help message
function show_help {
    echo "Usage: $0 -f FIREBASE_PROJECT -b BIGQUERY_PROJECT -i EXTENSION_INSTANCE_ID [-s SERVICE_ACCOUNT]"
    echo
    echo "Options:"
    echo "  -f    Firebase (source) project ID"
    echo "  -b    BigQuery project ID where dataset will be created"
    echo "  -i    Extension instance ID (default: firestore-bigquery-export)"
    echo "  -s    Service account email (optional, will be constructed if not provided)"
    echo "  -h    Show this help message"
    exit 1
}

# Set default extension instance ID
EXT_INSTANCE_ID="firestore-bigquery-export"

# Parse command line arguments
while getopts "f:b:i:s:h" opt; do
    case $opt in
        f) FIREBASE_PROJECT="$OPTARG";;
        b) BIGQUERY_PROJECT="$OPTARG";;
        i) EXT_INSTANCE_ID="$OPTARG";;
        s) SERVICE_ACCOUNT="$OPTARG";;
        h) show_help;;
        ?) show_help;;
    esac
done

# Check if required arguments are provided
if [ -z "$FIREBASE_PROJECT" ] || [ -z "$BIGQUERY_PROJECT" ]; then
    echo "Error: Both Firebase and BigQuery project IDs are required"
    show_help
fi

# Construct service account email if not provided
if [ -z "$SERVICE_ACCOUNT" ]; then
    SERVICE_ACCOUNT="ext-${EXT_INSTANCE_ID}@${FIREBASE_PROJECT}.iam.gserviceaccount.com"
fi

echo "Using service account: $SERVICE_ACCOUNT"
echo "Adding BigQuery permissions to $SERVICE_ACCOUNT on project: $BIGQUERY_PROJECT"
read -p "Continue? (y/N) " -n 1 -r
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Grant bigquery.dataEditor role
gcloud projects add-iam-policy-binding $BIGQUERY_PROJECT \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/bigquery.dataEditor"

# Grant bigquery.dataOwner which includes dataset.create permission
gcloud projects add-iam-policy-binding $BIGQUERY_PROJECT \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/bigquery.dataOwner"