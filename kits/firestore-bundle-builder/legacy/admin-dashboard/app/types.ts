import type { firestore } from "firebase-admin";

export type Bundle = {
  // Document id.
  id: string;
  docs?: string[] | null;
  queries?: {
    [key: string]: {
      collection: string;
      conditions?: {
        where?: [string, firestore.WhereFilterOp, any];
        orderBy?: [string, firestore.OrderByDirection];
        limit?: number;
        limitToLast?: number;
        offset?: number;
        startAt?: string;
        startAfter?: string;
        endAt?: string;
        endBefore?: string;
      }[];
    };
  };
  params?: {
    [key: string]: {
      required?: boolean;
      type: string;
    };
  };
  clientCache?: string | null;
  serverCache?: string | null;
  fileCache?: string | null;
  notBefore?: firestore.Timestamp | null;
};
