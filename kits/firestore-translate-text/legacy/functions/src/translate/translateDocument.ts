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
