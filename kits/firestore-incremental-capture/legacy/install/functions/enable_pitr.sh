echo -e "${YELLOW}Step 1: Enabling PITR as per Google Cloud Console guide${NC}"

if gcloud alpha firestore databases update --project=$PROJECT_ID --enable-pitr; then
  echo -e "${GREEN}PITR enabled successfully on (default) database.${NC}"
  SUCCESS_TASKS+=("${GREEN}${TICK} Enabled PiTR on (default) database.")
else
  echo -e "${RED}Failed to enable PITR on (default) database.${NC}"
  FAILED_TASKS+=("${RED}${CROSS} Failed to enable PiTR on (default) database.")
fi