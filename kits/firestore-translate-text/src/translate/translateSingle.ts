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
