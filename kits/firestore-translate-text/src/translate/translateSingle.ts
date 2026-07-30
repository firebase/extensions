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
import * as events from "../events";
import * as logs from "../logs";
import type { Translation, TranslationService } from "./common";

export const translateSingle = async (
  input: string,
  languages: ReadonlyArray<string>,
  snapshot: DocumentSnapshot,
  service: TranslationService
): Promise<void> => {
  logs.translateInputStringToAllLanguages(input, [...languages]);

  const tasks = languages.map(
    async (targetLanguage: string): Promise<Translation> => ({
      language: targetLanguage,
      output: await service.translateString(input, targetLanguage),
    })
  );

  try {
    const translations = await Promise.all(tasks);
    logs.translateInputToAllLanguagesComplete(input);
    const translationsMap: Record<string, string> = translations.reduce(
      (output, translation) => {
        output[translation.language] = translation.output;
        return output;
      },
      {} as Record<string, string>
    );

    return service.updateTranslations(snapshot, translationsMap);
  } catch (err) {
    logs.translateInputToAllLanguagesError(input, err as Error);
    await events.recordErrorEvent(err as Error);
    throw err;
  }
};
