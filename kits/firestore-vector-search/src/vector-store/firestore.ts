import type { Query, VectorQuery } from "@google-cloud/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { https } from "firebase-functions/v1";
import type { ResolvedVectorSearchConfig } from "../export-config";
import type { Prefilter } from "../queries";

export class FirestoreVectorStoreClient {
  constructor(
    private readonly firestore: Firestore,
    private readonly distanceMeasure: ResolvedVectorSearchConfig["distanceMeasure"]
  ) {}

  async query(
    query: number[],
    collection: string,
    prefilters: ReadonlyArray<Prefilter>,
    limit: number,
    outputField: string
  ): Promise<{ ids: string[] }> {
    try {
      const collectionRef = this.firestore.collection(collection);
      let firestoreQuery: Query | VectorQuery = collectionRef;
      for (const prefilter of prefilters) {
        firestoreQuery = firestoreQuery.where(
          prefilter.field,
          prefilter.operator,
          prefilter.value
        );
      }

      firestoreQuery = firestoreQuery.findNearest(outputField, query, {
        limit,
        distanceMeasure: this.distanceMeasure,
      });

      const result = await firestoreQuery.get();
      return { ids: result.docs.map((doc) => doc.ref.id) };
    } catch (err) {
      if (err instanceof https.HttpsError) throw err;
      throw new https.HttpsError(
        "unknown",
        err instanceof Error ? err.message : "Vector query failed"
      );
    }
  }
}
