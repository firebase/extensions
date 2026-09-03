/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Query, VectorQuery } from "@google-cloud/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { FirebaseFirestoreError } from "firebase-admin/firestore";
import { https } from "firebase-functions/v1";
import type { ResolvedVectorSearchConfig } from "../export-config";
import type { Prefilter } from "../queries";

/**
 * Firestore error codes that map one-to-one onto callable function error
 * codes. Anything outside this set is reported as `unknown`, with the original
 * Firestore code attached as details.
 */
const ALLOWED_ERROR_CODES = new Set<https.FunctionsErrorCode>([
  "cancelled",
  "unknown",
  "invalid-argument",
  "deadline-exceeded",
  "not-found",
  "already-exists",
  "permission-denied",
  "resource-exhausted",
  "aborted",
  "out-of-range",
  "unimplemented",
  "internal",
  "unavailable",
  "data-loss",
  "unauthenticated",
]);

export class FirestoreVectorStoreClient {
  constructor(
    private readonly firestore: Firestore,
    private readonly distanceMeasure: ResolvedVectorSearchConfig["distanceMeasure"]
  ) {}

  /** Converts thrown Firestore or general errors into structured HttpsError objects. */
  private toHttpsError(error: unknown, context?: string): https.HttpsError {
    if (error instanceof https.HttpsError) {
      return error;
    }

    if (error instanceof FirebaseFirestoreError) {
      const message = context || error.message;

      // the code is of the form firestore/code
      const [prefix, code] = error.code.split("/");

      // check the prefix is firestore anyway
      if (prefix !== "firestore") {
        return new https.HttpsError("unknown", message);
      }

      if (ALLOWED_ERROR_CODES.has(code as https.FunctionsErrorCode)) {
        return new https.HttpsError(code as https.FunctionsErrorCode, message);
      }
      return new https.HttpsError("unknown", message, {
        firestoreCode: error.code,
      });
    }

    if (error instanceof Error) {
      if (error.message.toLowerCase().includes("opstr")) {
        return new https.HttpsError(
          "invalid-argument",
          context
            ? `Invalid operator in query: ${context}`
            : "Invalid operator in Firestore query"
        );
      }

      return new https.HttpsError("unknown", error.message);
    }

    return new https.HttpsError(
      "unknown",
      "An unexpected error occurred performing your query"
    );
  }

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
        try {
          firestoreQuery = firestoreQuery.where(
            prefilter.field,
            prefilter.operator,
            prefilter.value
          );
        } catch (filterError) {
          throw this.toHttpsError(
            filterError,
            `${prefilter.operator} for ${prefilter.field}`
          );
        }
      }

      try {
        firestoreQuery = firestoreQuery.findNearest(outputField, query, {
          limit,
          distanceMeasure: this.distanceMeasure,
        });
      } catch (findNearestError) {
        throw this.toHttpsError(findNearestError);
      }

      const result = await firestoreQuery.get();
      return { ids: result.docs.map((doc) => doc.ref.id) };
    } catch (error) {
      throw this.toHttpsError(error);
    }
  }
}
