export type FirestoreDeleteMode = "recursive" | "shallow";

export interface DeleteUserDataConfig {
  firestorePaths?: string;
  firestoreDatabaseId?: string;
  firestoreDeleteMode?: FirestoreDeleteMode;
  rtdbInstance?: string;
  rtdbLocation?: string;
  rtdbPaths?: string;
  storageBucket?: string;
  storagePaths?: string;
  enableAutoDiscovery?: boolean;
  searchDepth?: number;
  searchFields?: string;
  searchFunction?: string;
  instanceId?: string;
  discoveryTopicName?: string;
  deletionTopicName?: string;
  region?: string;
  projectId?: string;
}

export interface ResolvedDeleteUserDataConfig {
  firestorePaths?: string;
  firestoreDatabaseId: string;
  firestoreDeleteMode: FirestoreDeleteMode;
  rtdbInstance?: string;
  rtdbLocation?: string;
  rtdbPaths?: string;
  storageBucket?: string;
  storagePaths?: string;
  enableAutoDiscovery: boolean;
  searchDepth: number;
  searchFields: string;
  searchFunction?: string;
  instanceId: string;
  discoveryTopicName: string;
  deletionTopicName: string;
  region: string;
  projectId?: string;
}

const DEFAULT_FIRESTORE_DATABASE_ID = "(default)";
const DEFAULT_FIRESTORE_DELETE_MODE: FirestoreDeleteMode = "shallow";
const DEFAULT_SEARCH_DEPTH = 3;
const DEFAULT_SEARCH_FIELDS = "id,uid,userId";
const DEFAULT_REGION = "us-central1";
const DEFAULT_INSTANCE_ID = "delete-user-data";

function topicName(
  name: string | undefined,
  instanceId: string,
  suffix: string
): string {
  return name ?? `ext-${instanceId}-${suffix}`;
}

export function resolveDeleteUserDataConfig(
  config: DeleteUserDataConfig
): ResolvedDeleteUserDataConfig {
  const instanceId = config.instanceId ?? DEFAULT_INSTANCE_ID;
  return {
    firestorePaths: config.firestorePaths,
    firestoreDatabaseId:
      config.firestoreDatabaseId ?? DEFAULT_FIRESTORE_DATABASE_ID,
    firestoreDeleteMode:
      config.firestoreDeleteMode ?? DEFAULT_FIRESTORE_DELETE_MODE,
    rtdbInstance: config.rtdbInstance,
    rtdbLocation: config.rtdbLocation,
    rtdbPaths: config.rtdbPaths,
    storageBucket: config.storageBucket,
    storagePaths: config.storagePaths,
    enableAutoDiscovery: config.enableAutoDiscovery ?? false,
    searchDepth: config.searchDepth ?? DEFAULT_SEARCH_DEPTH,
    searchFields: config.searchFields ?? DEFAULT_SEARCH_FIELDS,
    searchFunction: config.searchFunction,
    instanceId,
    discoveryTopicName: topicName(
      config.discoveryTopicName,
      instanceId,
      "discovery"
    ),
    deletionTopicName: topicName(
      config.deletionTopicName,
      instanceId,
      "deletion"
    ),
    region: config.region ?? DEFAULT_REGION,
    projectId: config.projectId,
  };
}

export function getDatabaseUrl(
  selectedDatabaseInstance: string | undefined,
  selectedDatabaseLocation: string | undefined
): string | null {
  if (!selectedDatabaseLocation || !selectedDatabaseInstance) return null;
  if (selectedDatabaseLocation === "us-central1") {
    return `https://${selectedDatabaseInstance}.firebaseio.com`;
  }
  return `https://${selectedDatabaseInstance}.${selectedDatabaseLocation}.firebasedatabase.app`;
}
