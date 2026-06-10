import {createIndex, checkCreateIndexProgress} from '../../src/queries/setup';
import {firestoreAdminClient} from '../../src/config';
import * as functions from 'firebase-functions/v1';

describe('createIndex', () => {
  const testOptions = {
    collectionName: 'testCollection',
    dimension: 10,
    projectId: 'test-project',
    fieldPath: 'testField',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should create index when it does not exist', async () => {
    // Mock listIndexes to return empty array (no existing indexes)
    (firestoreAdminClient.listIndexes as jest.Mock).mockResolvedValue([[]]);

    const mockIndexResult = {
      name: 'projects/test-project/databases/(default)/collectionGroups/testCollection/indexes/123',
      queryScope: 'COLLECTION',
      fields: [
        {
          fieldPath: 'testField',
          vectorConfig: {
            dimension: 10,
            flat: {},
          },
        },
      ],
    };

    (firestoreAdminClient.createIndex as jest.Mock).mockResolvedValue(
      mockIndexResult
    );

    await createIndex(testOptions);

    expect(firestoreAdminClient.listIndexes).toHaveBeenCalledWith({
      parent: `projects/${testOptions.projectId}/databases/(default)/collectionGroups/${testOptions.collectionName}`,
    });

    expect(firestoreAdminClient.createIndex).toHaveBeenCalledWith({
      parent: `projects/${testOptions.projectId}/databases/(default)/collectionGroups/${testOptions.collectionName}`,
      index: {
        queryScope: 'COLLECTION',
        fields: [
          {
            fieldPath: testOptions.fieldPath,
            vectorConfig: {
              dimension: testOptions.dimension,
              flat: {},
            },
          },
        ],
      },
    });

    expect(functions.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Index created:')
    );
  });

  test('should skip index creation when index already exists', async () => {
    // Mock listIndexes to return existing matching index
    const existingIndex = {
      name: `projects/${testOptions.projectId}/databases/(default)/collectionGroups/${testOptions.collectionName}/indexes/123`,
      fields: [
        {
          fieldPath: testOptions.fieldPath,
        },
      ],
    };

    (firestoreAdminClient.listIndexes as jest.Mock).mockResolvedValue([
      [existingIndex],
    ]);

    await createIndex(testOptions);

    expect(firestoreAdminClient.listIndexes).toHaveBeenCalled();
    expect(firestoreAdminClient.createIndex).not.toHaveBeenCalled();
    expect(functions.logger.info).toHaveBeenCalledWith(
      'Index already exists, skipping index creation'
    );
  });

  test('should handle listIndexes error', async () => {
    (firestoreAdminClient.listIndexes as jest.Mock).mockRejectedValue(
      new Error('Failed to list indexes')
    );

    await expect(createIndex(testOptions)).rejects.toThrow(
      'Failed to list indexes'
    );
    expect(firestoreAdminClient.createIndex).not.toHaveBeenCalled();
  });

  test('should handle createIndex error', async () => {
    (firestoreAdminClient.listIndexes as jest.Mock).mockResolvedValue([[]]);
    (firestoreAdminClient.createIndex as jest.Mock).mockRejectedValue(
      new Error('Failed to create index')
    );

    await expect(createIndex(testOptions)).rejects.toThrow(
      'Failed to create index'
    );
  });
});

describe('checkCreateIndexProgress', () => {
  const testIndexName =
    'projects/test-project/databases/(default)/collectionGroups/testCollection/indexes/123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return index status', async () => {
    const mockIndexStatus = {
      name: testIndexName,
      state: 'READY',
    };

    (firestoreAdminClient.getIndex as jest.Mock).mockResolvedValue(
      mockIndexStatus
    );

    const result = await checkCreateIndexProgress(testIndexName);

    expect(firestoreAdminClient.getIndex).toHaveBeenCalledWith({
      name: testIndexName,
    });
    expect(result).toEqual(mockIndexStatus);
  });

  test('should handle getIndex error', async () => {
    (firestoreAdminClient.getIndex as jest.Mock).mockRejectedValue(
      new Error('Failed to get index status')
    );

    await expect(checkCreateIndexProgress(testIndexName)).rejects.toThrow(
      'Failed to get index status'
    );
  });
});
