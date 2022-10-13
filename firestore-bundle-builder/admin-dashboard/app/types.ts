/*
 * Copyright 2022 Google LLC
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
