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

import * as logs from "../logs";
import * as admin from "firebase-admin";
import * as validators from "../validators";
import config from "../config";
import {
  extractInput,
  extractLanguages,
  extractOutput,
  filterLanguagesFn,
  translateString,
  Translation,
  updateTranslations,
} from "./common";
import {
  translateMultiple,
  translateMultipleBackfill,
} from "./translateMultiple";
import { translateSingle, translateSingleBackfill } from "./translateSingle";

export const translateDocumentBackfill = async (
  snapshot: admin.firestore.DocumentSnapshot,
  bulkWriter: admin.firestore.BulkWriter
): Promise<void> => {
  const input: any = extractInput(snapshot);

  if (typeof input === "object") {
    return translateMultipleBackfill(input, snapshot, bulkWriter);
  }

  await translateSingleBackfill(input, snapshot, bulkWriter);
};

export const translateDocument = async (
  snapshot: admin.firestore.DocumentSnapshot
): Promise<void> => {
  const input: any = extractInput(snapshot);
  const languages = extractLanguages(snapshot);

  if (
    validators.fieldNameIsTranslationPath(
      config.inputFieldName,
      config.outputFieldName,
      languages
    )
  ) {
    logs.inputFieldNameIsOutputPath();
    return;
  }

  if (typeof input === "object") {
    return translateMultiple(input, languages, snapshot);
  }

  await translateSingle(input, languages, snapshot);
};
