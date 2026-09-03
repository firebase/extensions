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

import type { DocumentSnapshot, Firestore } from "firebase-admin/firestore";
import { vi } from "vitest";
import {
  type ResolvedTranslateConfig,
  resolveTranslateConfig,
  type TranslateConfig,
} from "../src/export-config";
import type { TranslateWriteEvent } from "../src/handlers";

/**
 * Mirrors the fixed translation table the extension test suite asserts against
 * (`functions/__tests__/mocks/translate.ts`).
 */
export const testTranslations: Record<string, string> = {
  de: "hallo",
  en: "hello",
  es: "hola",
  fr: "salut",
};

/**
 * Mirrors `defaultEnvironment` from the extension's `functions.test.ts`.
 */
export const defaultEnvironment = {
  PROJECT_ID: "fake-project",
  LOCATION: "us-central1",
  LANGUAGES: "en,es,de,fr",
  COLLECTION_PATH: "translations",
  INPUT_FIELD_NAME: "input",
  OUTPUT_FIELD_NAME: "translated",
  LANGUAGES_FIELD_NAME: "langs",
};

export const defaultLanguages = defaultEnvironment.LANGUAGES.split(",");

export function makeConfig(
  overrides: Partial<TranslateConfig> = {}
): ResolvedTranslateConfig {
  return resolveTranslateConfig({
    collectionPath: defaultEnvironment.COLLECTION_PATH,
    inputFieldName: defaultEnvironment.INPUT_FIELD_NAME,
    outputFieldName: defaultEnvironment.OUTPUT_FIELD_NAME,
    languages: defaultEnvironment.LANGUAGES,
    languagesFieldName: defaultEnvironment.LANGUAGES_FIELD_NAME,
    region: defaultEnvironment.LOCATION,
    projectId: defaultEnvironment.PROJECT_ID,
    ...overrides,
  });
}

/**
 * Stands in for `firebase-functions-test`'s `makeDocumentSnapshot`. An empty
 * field set reports `exists: false` so change types resolve the same way the
 * extension tests expect; pass `exists` to force the flag (the extension does
 * the same thing through `mockDocumentSnapshotFactory`).
 */
export function makeSnapshot(
  fields?: Record<string, unknown>,
  {
    path = "translations/id1",
    exists,
  }: { path?: string; exists?: boolean } = {}
): DocumentSnapshot {
  const data = fields ?? {};
  return {
    exists: exists ?? Object.keys(data).length > 0,
    id: path.split("/").pop(),
    ref: { path },
    data: () => (fields ? { ...data } : undefined),
    get: (fieldPath: string) =>
      String(fieldPath)
        .split(".")
        .reduce<any>(
          (value, key) => (value == null ? undefined : value[key]),
          data
        ),
  } as unknown as DocumentSnapshot;
}

export const EVENT_ID = "event-1";
export const EVENT_TIME = "2026-01-01T00:00:00.000Z";
export const EVENT_PROJECT = "demo-project";
export const EVENT_DATABASE = "(default)";
export const EVENT_DOCUMENT = "translations/id1";

export function makeEvent(
  before: DocumentSnapshot | undefined,
  after: DocumentSnapshot | undefined,
  params: Record<string, string> = { messageId: "id1" }
): TranslateWriteEvent {
  return {
    id: EVENT_ID,
    time: EVENT_TIME,
    project: EVENT_PROJECT,
    database: EVENT_DATABASE,
    document: EVENT_DOCUMENT,
    data: before || after ? { before, after } : undefined,
    params,
  } as unknown as TranslateWriteEvent;
}

/**
 * The 1st gen `EventContext` the extension published inside its `onStart` and
 * `onCompletion` payloads, as rebuilt from the event `makeEvent` produces.
 */
export function expectedEventContext(
  params: Record<string, string> = { messageId: "id1" }
) {
  return {
    eventId: EVENT_ID,
    timestamp: EVENT_TIME,
    eventType: "google.firestore.document.write",
    resource: {
      service: "firestore.googleapis.com",
      name: `projects/${EVENT_PROJECT}/databases/${EVENT_DATABASE}/documents/${EVENT_DOCUMENT}`,
    },
    params,
  };
}

/**
 * A `Firestore` stub whose transaction handler records `update` calls, matching
 * `mockFirestoreTransaction`/`mockFirestoreUpdate` in the extension tests.
 */
export function makeFirestore() {
  const update = vi.fn();
  const runTransaction = vi.fn(async (handler: (tx: any) => Promise<void>) =>
    handler({ update })
  );

  return {
    firestore: { runTransaction } as unknown as Firestore,
    update,
    runTransaction,
  };
}
