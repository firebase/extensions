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
