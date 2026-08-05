import { v1 as FirestoreV1 } from "@google-cloud/firestore";
import { logger } from "firebase-functions";

export interface CreateIndexOptions {
  collectionName: string;
  dimension: number;
  projectId: string;
  fieldPath: string;
}

const firestoreAdminClient = new FirestoreV1.FirestoreAdminClient();

const getParent = (options: CreateIndexOptions): string =>
  `projects/${options.projectId}/databases/(default)/collectionGroups/${options.collectionName}`;

const getIndex = (options: CreateIndexOptions) => ({
  queryScope: "COLLECTION" as const,
  fields: [
    {
      fieldPath: options.fieldPath,
      vectorConfig: {
        dimension: options.dimension,
        flat: {},
      },
    },
  ],
});

export async function createIndex(options: CreateIndexOptions): Promise<void> {
  const [indexes] = await firestoreAdminClient.listIndexes({
    parent: getParent(options),
  });
  const indexExists = indexes.some((index) => {
    const hasCollectionName = index.name?.includes(options.collectionName);
    const hasFieldPath = index.fields?.some(
      (field) => field.fieldPath === options.fieldPath
    );
    return hasCollectionName && hasFieldPath;
  });

  if (indexExists) {
    logger.info("Index already exists, skipping index creation");
    return;
  }

  const result = await firestoreAdminClient.createIndex({
    parent: getParent(options),
    index: getIndex(options),
  });
  logger.info(`Index created: ${JSON.stringify(result)}`);
}
