import {firestoreAdminClient} from '../config';
import * as functions from 'firebase-functions/v1';

interface CreateIndexOptions {
  collectionName: string;
  dimension: number;
  projectId: string;
  fieldPath: string;
}

const getParent = (options: CreateIndexOptions) =>
  `projects/${options.projectId}/databases/(default)/collectionGroups/${options.collectionName}`;

const getIndex = (options: CreateIndexOptions) => ({
  queryScope: 'COLLECTION' as const,
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

export async function createIndex(options: CreateIndexOptions) {
  const allIndexes = await firestoreAdminClient.listIndexes({
    parent: getParent(options),
  });
  const indexExists = allIndexes[0].some(index => {
    const hasCollectionName = index.name?.includes(options.collectionName);
    const hasFieldPath = index.fields?.some(
      field => field.fieldPath === options.fieldPath
    );
    return hasCollectionName && hasFieldPath;
  });

  if (indexExists) {
    functions.logger.info('Index already exists, skipping index creation');
    return;
  }

  const result = await firestoreAdminClient.createIndex({
    parent: getParent(options),
    index: getIndex(options),
  });

  functions.logger.info(`Index created: ${JSON.stringify(result)}`);
}

export async function checkCreateIndexProgress(indexName: string) {
  const result = await firestoreAdminClient.getIndex({name: indexName});
  console.log(`Index status: ${JSON.stringify(result)}`);
  return result;
}
