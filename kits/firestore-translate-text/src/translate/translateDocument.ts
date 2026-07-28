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
