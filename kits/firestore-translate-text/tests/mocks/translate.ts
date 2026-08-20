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

import { vi } from "vitest";
import { testTranslations } from "../helpers";

/** `await client.translate("hello", "de")` */
export const translateClassMethod = vi.fn(
  async (text: string, targetLanguage: string): Promise<[string]> => [
    testTranslations[targetLanguage] ?? `${text}-${targetLanguage}`,
  ]
);

/** `new v2.Translate(opts)` — declared as a function so `new` works. */
export const translateClass = vi.fn(function Translate(_options?: {
  projectId?: string;
}) {
  return { translate: translateClassMethod };
});

/** Module shape of `@google-cloud/translate`. */
export const v2 = { Translate: translateClass };

export function resetTranslateMocks(): void {
  translateClass.mockClear();
  translateClassMethod.mockClear();
  translateClassMethod.mockImplementation(async (text, targetLanguage) => [
    testTranslations[targetLanguage] ?? `${text}-${targetLanguage}`,
  ]);
}
