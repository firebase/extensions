import * as admin from "firebase-admin";
import config from "../../../config";
const firestore = admin.firestore();
import * as functions from "firebase-functions";

const logger = functions.logger;

const READ_CHUNK_SIZE = 10000;

export const getDocumentsChunk = async (
  lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null
) => {
  logger.info("Starting getDocumentsBatch function.", { lastDoc });

  let query = firestore
    .collection(config.backfillOptions.collectionPath)
    .orderBy("__name__")
    .select("__name__")
    .limit(READ_CHUNK_SIZE);

  if (lastDoc) {
    query = query.startAfter(lastDoc);
    logger.info("Query starting after lastDoc.", { lastDoc });
  }

  const snapshot = await query.get();
  logger.info("Query executed. Snapshot received.", {
    snapshotSize: snapshot.size,
  });

  const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  logger.info("New lastDoc determined.", { newLastDoc });

  return { snapshot, newLastDoc };
};
