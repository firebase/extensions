# Check if Firestore database already exists
echo -e "${YELLOW}Step 2: Setting up Firestore database${NC}"
DB_EXISTS=$(gcloud alpha firestore databases list --project=$PROJECT_ID --format="value(name)")

if echo "$DB_EXISTS" | grep -q "projects/$PROJECT_ID/databases/$DATABASE_ID"; then
  echo -e "${GREEN}Firestore database already exists, skipping creation.${NC}"
  SUCCESS_TASKS+=("${GREEN}${TICK} Database already exists, setup skipped.")
else
  # Create secondary Firestore database
  echo -e "${YELLOW}Creating secondary Firestore database...${NC}"
  if gcloud alpha firestore databases create --database=$DATABASE_ID --location=$DATABASE_LOCATION --type=firestore-native --project=$PROJECT_ID; then
    echo -e "${GREEN}Firestore database created successfully.${NC}"
    SUCCESS_TASKS+=("${GREEN}${TICK} Database created successfully.")
  else
    echo -e "${RED}Failed to create Firestore database.${NC}"
    FAILED_TASKS+=("${RED}${CROSS} Failed to create Firestore database.")
  fi
fi