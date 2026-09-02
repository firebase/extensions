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

import { type DocumentSnapshot, FieldValue } from "firebase-admin/firestore";
import type { Change, FirestoreEvent } from "firebase-functions/v2/firestore";
import * as events from "./events";
import type { ResolvedTranslateConfig } from "./export-config";
import * as logs from "./logs";
import { type TranslationService, translateDocument } from "./translate";
import * as validators from "./validators";

const CHANGE_TYPE = {
  create: "create",
  delete: "delete",
  update: "update",
} as const;

type ChangeType = (typeof CHANGE_TYPE)[keyof typeof CHANGE_TYPE];

export interface HandlerContext {
  config: ResolvedTranslateConfig;
  service: TranslationService;
}

export type TranslateWriteEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  Record<string, string>
>;

function getChangeType(change: Change<DocumentSnapshot>): ChangeType {
  if (!change.after.exists) {
    return CHANGE_TYPE.delete;
  }
  if (!change.before.exists) {
    return CHANGE_TYPE.create;
  }
  return CHANGE_TYPE.update;
}

export async function handleDocumentWrite(
  event: TranslateWriteEvent,
  ctx: HandlerContext
): Promise<void> {
  if (!event.data) {
    return;
  }

  const { config, service } = ctx;

  logs.start(config);
  await events.recordStartEvent({ data: event.data, params: event.params });

  const { languages, inputFieldName, outputFieldName } = config;

  if (validators.fieldNamesMatch(inputFieldName, outputFieldName)) {
    logs.fieldNamesNotDifferent();
    await events.recordCompletionEvent({ params: event.params });
    return;
  }

  if (
    validators.fieldNameIsTranslationPath(inputFieldName, outputFieldName, [
      ...languages,
    ])
  ) {
    logs.inputFieldNameIsOutputPath();
    await events.recordCompletionEvent({ params: event.params });
    return;
  }

  try {
    switch (getChangeType(event.data)) {
      case CHANGE_TYPE.create:
        await handleCreateDocument(event.data.after, service, config);
        break;
      case CHANGE_TYPE.delete:
        handleDeleteDocument();
        break;
      case CHANGE_TYPE.update:
        await handleUpdateDocument(
          event.data.before,
          event.data.after,
          service,
          config
        );
        break;
    }

    logs.complete();
  } catch (err) {
    logs.error(err as Error);
    await events.recordErrorEvent(err as Error);
  }
  await events.recordCompletionEvent({ params: event.params });
}

async function handleCreateDocument(
  snapshot: DocumentSnapshot,
  service: TranslationService,
  config: ResolvedTranslateConfig
): Promise<void> {
  const input = service.extractInput(snapshot);
  if (input) {
    logs.documentCreatedWithInput();
    await translateDocument(snapshot, service, config);
  } else {
    logs.documentCreatedNoInput();
  }
}

function handleDeleteDocument(): void {
  logs.documentDeleted();
}

async function handleUpdateDocument(
  before: DocumentSnapshot,
  after: DocumentSnapshot,
  service: TranslationService,
  config: ResolvedTranslateConfig
): Promise<void> {
  const inputBefore = service.extractInput(before);
  const inputAfter = service.extractInput(after);
  const languagesBefore = service.extractLanguages(before);
  const languagesAfter = service.extractLanguages(after);

  if (inputBefore === undefined && inputAfter === undefined) {
    logs.documentUpdatedNoInput();
    return;
  }

  if (typeof inputAfter !== "string" && typeof inputAfter !== "object") {
    await service.updateTranslations(after, FieldValue.delete());
    logs.documentUpdatedDeletedInput();
    return;
  }

  if (
    JSON.stringify(inputBefore) === JSON.stringify(inputAfter) &&
    JSON.stringify(languagesBefore) === JSON.stringify(languagesAfter)
  ) {
    logs.documentUpdatedUnchangedInput();
  } else {
    logs.documentUpdatedChangedInput();
    await translateDocument(after, service, config);
  }
}
