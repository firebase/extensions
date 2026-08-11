#!/bin/bash

# Find extension's service account email
echo -e "${YELLOW}Finding extension's service account email...${NC}"

# Get all service accounts that match our filter
SA_EMAILS=$(gcloud iam service-accounts list --format="value(EMAIL)" --filter="displayName~'Firebase Extensions $EXT_INSTANCE_ID service account' AND DISABLED=False" --project="$PROJECT_ID")

# Check if we found any service accounts
if [ -z "$SA_EMAILS" ]; then
  echo -e "${RED}Failed to find extension's service account email.${NC}"
  FAILED_TASKS+=("${RED}${CROSS} Failed to find extension's service account.")
  exit 1  # Exit if no service account is found as the next steps need it
else
  # Use the first service account from the list
  export SA_EMAIL=$(echo "$SA_EMAILS" | head -n 1)
  echo -e "${GREEN}Service account email found: $SA_EMAIL${NC}"
  
  # Show all found service accounts for debugging
  echo "$SA_EMAILS"
  
  SUCCESS_TASKS+=("${GREEN}${TICK} Found extension's service account.")
fi

# Add required policy binding for Artifact Registry
echo -e "${YELLOW}Step 4: Adding IAM policy binding for Artifact Registry...${NC}"
if gcloud artifacts repositories add-iam-policy-binding $EXT_INSTANCE_ID \
  --location=$LOCATION \
  --project=$PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role=roles/artifactregistry.writer \
  --condition=None; then
  echo -e "${GREEN}Policy binding added successfully.${NC}"
  SUCCESS_TASKS+=("${GREEN}${TICK} Policy binding added successfully.")
else
  echo -e "${RED}Failed to add policy binding.${NC}"
  FAILED_TASKS+=("${RED}${CROSS} Failed to add policy binding.")
fi

# Add roles for extension service account to trigger Dataflow
echo -e "${YELLOW}Step 5: Adding roles for service account to trigger Dataflow...${NC}"
ROLE_SUCCESS=true

if ! gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role=roles/dataflow.developer \
  --condition=None; then
  ROLE_SUCCESS=false
fi

if ! gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role=roles/iam.serviceAccountUser \
  --condition=None; then
  ROLE_SUCCESS=false
fi

if ! gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role=roles/artifactregistry.writer \
  --condition=None; then
  ROLE_SUCCESS=false
fi

if [ "$ROLE_SUCCESS" = true ]; then
  echo -e "${GREEN}Roles added successfully.${NC}"
  SUCCESS_TASKS+=("${GREEN}${TICK} Roles added successfully")
else
  echo -e "${RED}Failed to add one or more roles.${NC}"
  FAILED_TASKS+=("${RED}${CROSS} Failed to add one or more roles.")
fi