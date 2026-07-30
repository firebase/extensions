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

import type { DocumentSnapshot } from "firebase-admin/firestore";
import type { ResolvedTranslateConfig } from "../export-config";
import * as logs from "../logs";
import * as validators from "../validators";
import type { TranslationService } from "./common";
import { translateMultiple } from "./translateMultiple";
import { translateSingle } from "./translateSingle";

export const translateDocument = async (
  snapshot: DocumentSnapshot,
  service: TranslationService,
  config: ResolvedTranslateConfig
): Promise<void> => {
  const input = service.extractInput(snapshot);
  const languages = service.extractLanguages(snapshot);

  if (
    validators.fieldNameIsTranslationPath(
      config.inputFieldName,
      config.outputFieldName,
      [...languages]
    )
  ) {
    logs.inputFieldNameIsOutputPath();
    return;
  }

  if (typeof input === "object" && input !== null) {
    return translateMultiple(
      input as Record<string, unknown>,
      languages,
      snapshot,
      service
    );
  }

  await translateSingle(String(input), languages, snapshot, service);
};
