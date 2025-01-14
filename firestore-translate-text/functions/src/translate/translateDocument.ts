import * as logs from "../logs";
import * as admin from "firebase-admin";
import * as validators from "../validators";
import config from "../config";
import { extractInput, extractLanguages } from "./common";
import {
  translateMultiple,
  translateMultipleBackfill,
} from "./translateMultiple";
import { translateSingle, translateSingleBackfill } from "./translateSingle";

export const translateDocumentBackfill = async (
  snapshot: admin.firestore.DocumentSnapshot,
  bulkWriter: admin.firestore.BulkWriter,
  glossaryId?: string
): Promise<void> => {
  const input: any = extractInput(snapshot);

  if (typeof input === "object") {
    return translateMultipleBackfill(
      input,
      snapshot,
      bulkWriter,
      config.glossaryId
    );
  }

  await translateSingleBackfill(input, snapshot, bulkWriter, config.glossaryId);
};

export const translateDocument = async (
  snapshot: admin.firestore.DocumentSnapshot,
  glossaryId?: string
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
    return translateMultiple(input, languages, snapshot, config.glossaryId);
  }

  await translateSingle(input, languages, snapshot, config.glossaryId);
};
