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
import * as logs from "../logs";
import type { TranslationService } from "./common";

export const translateMultiple = async (
  input: Record<string, unknown>,
  languages: ReadonlyArray<string>,
  snapshot: DocumentSnapshot,
  service: TranslationService
): Promise<void> => {
  const translations: Record<string, Record<string, string | null>> = {};
  const tasks: Array<() => Promise<void>> = [];

  Object.entries(input).forEach(([inputKey, value]) => {
    languages.forEach((language) => {
      tasks.push(async () => {
        logs.translateInputStringToAllLanguages(String(value), [...languages]);
        const output =
          typeof value === "string"
            ? await service.translateString(value, language)
            : null;

        if (!translations[inputKey]) translations[inputKey] = {};
        translations[inputKey][language] = output;
      });
    });
  });

  for (const task of tasks) {
    await task();
  }

  return service.updateTranslations(snapshot, translations);
};
