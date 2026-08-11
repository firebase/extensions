echo -e "${YELLOW}Step 6: Building Dataflow Flex Template...${NC}"
if gcloud dataflow flex-template build gs://$BUCKET_NAME/$EXT_INSTANCE_ID-dataflow-restore \
  --image-gcr-path $LOCATION-docker.pkg.dev/$PROJECT_ID/$EXT_INSTANCE_ID/dataflow/restore:latest \
  --sdk-language JAVA \
  --flex-template-base-image JAVA11 \
  --jar $JAR_PATH \
  --env FLEX_TEMPLATE_JAVA_MAIN_CLASS="com.pipeline.RestorationPipeline" \
  --project $PROJECT_ID; then
  echo -e "${GREEN}Dataflow Flex Template built successfully.${NC}"
  SUCCESS_TASKS+=("${GREEN}${TICK} Dataflow Flex Template built successfully.")
else
  echo -e "${RED}Failed to build Dataflow Flex Template.${NC}"
  FAILED_TASKS+=("${RED}${CROSS} Failed to build Dataflow Flex Template.")
fi