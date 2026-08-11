#!/bin/bash

# Define color codes for better readability
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export NC='\033[0m'
export TICK="✓"
export CROSS="✗"

# Initialize arrays to hold success and failure messages
export SUCCESS_TASKS=()
export FAILED_TASKS=()

# Define variables at the top
export PROJECT_ID=""
export BUCKET_NAME=""
export DATABASE_ID=""
export DATABASE_LOCATION="nam5"
export LOCATION="us-central1"
export EXT_INSTANCE_ID="firestore-incremental-capture"
export JAR_PATH="restore-firestore.jar"

# Detect default bucket automatically only if BUCKET_NAME is not set
detect_default_bucket() {
  # Skip if BUCKET_NAME is already set
  if [ -n "$BUCKET_NAME" ]; then
    echo "Using user-specified bucket: $BUCKET_NAME"
    return
  fi
  
  echo "Detecting default storage bucket..."
  
  # Try to list buckets and check for default buckets
  local buckets=$(gcloud storage buckets list --project=$PROJECT_ID --format="value(name)")
  
  # Check for both possible default bucket names
  if echo "$buckets" | grep -q "$PROJECT_ID.appspot.com"; then
    echo "Detected default bucket: $PROJECT_ID.appspot.com"
    BUCKET_NAME="$PROJECT_ID.appspot.com"
  elif echo "$buckets" | grep -q "$PROJECT_ID.firebasestorage.app"; then
    echo "Detected default bucket: $PROJECT_ID.firebasestorage.app"
    BUCKET_NAME="$PROJECT_ID.firebasestorage.app"
  else
    echo -e "${YELLOW}Warning: Could not detect default bucket, using fallback strategy${NC}"
    # Use a fallback approach - newest default bucket format
    BUCKET_NAME="$PROJECT_ID.firebasestorage.app"
  fi
  
  echo "Using bucket: $BUCKET_NAME"
}

# Call the detect function after PROJECT_ID is set
detect_default_bucket

# Source all component scripts
source ./functions/download_restore_firestore.sh
source ./functions/enable_pitr.sh
source ./functions/setup_firestore.sh
source ./functions/setup_artifact_registry.sh
source ./functions/setup_service_account.sh
source ./functions/build_dataflow_template.sh

# Print summary
echo -e "\n${GREEN}Setup process completed.${NC}"

if [ ${#SUCCESS_TASKS[@]} -gt 0 ]; then
  echo -e "\n${GREEN}Successful operations:${NC}"
  for TASK in "${SUCCESS_TASKS[@]}"; do
    echo -e "$TASK"
  done
fi

if [ ${#FAILED_TASKS[@]} -gt 0 ]; then
  echo -e "\n${RED}Failed operations:${NC}"
  for TASK in "${FAILED_TASKS[@]}"; do
    echo -e "$TASK"
  done
  echo -e "\n${RED}Warning: Some operations failed. Please review the errors above.${NC}"
  exit 1
else
  echo -e "\n${GREEN}All operations completed successfully!${NC}"
fi