echo -e "${YELLOW}Downloading the JAR file...${NC}"

# Use the correct URL
if curl -L -o restore-firestore.jar "https://github.com/GoogleCloudPlatform/firebase-extensions/raw/main/firestore-incremental-capture-pipeline/target/restore-firestore.jar"; then
  # Check if the file is actually a JAR and not HTML
  if file restore-firestore.jar | grep -q "HTML"; then
    echo -e "${YELLOW}The downloaded file appears to be an HTML page, not a JAR file. The file may not exist at that location.${NC}"
    
    # Try alternative sources
    echo -e "${YELLOW}Trying alternative locations...${NC}"
    
    # Alternative 1: Try Firebase Extensions GitHub repo directly
    if curl -L -o restore-firestore.jar "https://github.com/firebase/extensions/raw/main/firestore-incremental-capture-pipeline/target/restore-firestore.jar"; then
      if ! file restore-firestore.jar | grep -q "HTML"; then
        echo -e "${GREEN}JAR file downloaded successfully from alternative location.${NC}"
        SUCCESS_TASKS+=("${GREEN}${TICK} Successfully downloaded assets.")
        exit 0
      fi
    fi
    
    # Alternative 2: Try checking Google Cloud Storage
    echo -e "${YELLOW}Trying to download from Cloud Storage...${NC}"
    if gcloud storage cp gs://firebase-preview-drop/extension-builds/firestore-incremental-capture/restore-firestore.jar ./restore-firestore.jar 2>/dev/null; then
      echo -e "${GREEN}JAR file downloaded successfully from Cloud Storage.${NC}"
      SUCCESS_TASKS+=("${GREEN}${TICK} Successfully downloaded assets.")
      exit 0
    fi
    
    # If all attempts fail
    echo -e "${RED}Failed to download a valid JAR file from all known locations.${NC}"
    echo -e "${YELLOW}You may need to build the JAR from source or contact Firebase support.${NC}"
    FAILED_TASKS+=("${RED}${CROSS} Failed to download assets.")
    exit 1
  else
    echo -e "${GREEN}JAR file downloaded successfully.${NC}"
    SUCCESS_TASKS+=("${GREEN}${TICK} Successfully downloaded assets.")
  fi
else
  echo -e "${RED}Failed to download JAR file.${NC}"
  FAILED_TASKS+=("${RED}${CROSS} Failed to download assets.")
  exit 1
fi