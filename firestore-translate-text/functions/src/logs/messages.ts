export const messages = {
  backfillComplete: (successCount: number, errorCount: number) =>
    `Finshed backfilling translations. ${successCount} translations succeeded, ${errorCount} errors.`,
  complete: () => "Completed execution of extension",
  documentCreatedNoInput: () =>
    "Document was created without an input string, no processing is required",
  documentCreatedWithInput: () => "Document was created with an input string",
  documentFoundWithInput: () => "Backfill found document with an input string",
  documentFoundNoInput: () =>
    "Backfill found document without an input string, no processing is required",
  documentDeleted: () => "Document was deleted, no processing is required",
  documentUpdatedChangedInput: () =>
    "Document was updated, input string has changed",
  documentUpdatedDeletedInput: () =>
    "Document was updated, input string was deleted",
  documentUpdatedNoInput: () =>
    "Document was updated, no input string exists, no processing is required",
  documentUpdatedUnchangedInput: () =>
    "Document was updated, input string has not changed, no processing is required",
  error: (err: Error) => ["Failed execution of extension", err],
  enqueueNext: (offset: number) =>
    `About to enqueue next task, starting at offset ${offset}`,
  fieldNamesNotDifferent: () =>
    "The `Input` and `Output` field names must be different for this extension to function correctly",
  init: (config = {}) => [
    "Initializing extension with the parameter values",
    config,
  ],
  inputFieldNameIsOutputPath: () =>
    "The `Input` field name must not be the same as an `Output` path for this extension to function correctly",
  partialTranslateError: (input: string, reasons: string[], numLanguages) =>
    `Failed to translate ${input} to ${
      reasons.length
    } languages of the requested ${numLanguages}. Reasons: ${reasons.join(
      "\n"
    )}`,
  skippingLanguage: (lang: string) =>
    `Found existing translation to ${lang}, skipping.`,
  start: (config = {}) => [
    "Started execution of extension with configuration",
    config,
  ],
  translateInputString: (string: string, language: string) =>
    `Translating string: '${string}' into language(s): '${language}'`,
  translateStringComplete: (
    string: string,
    language: string,
    translated: string
  ) =>
    `Finished translating string: '${string}' into language(s): '${language}' : '${translated}'`,
  translateStringError: (string: string, language: string, err: Error) => [
    `Error when translating string: '${string}' into language(s): '${language}'`,
    err,
  ],
  translateInputStringToAllLanguages: (string: string, languages: string[]) =>
    `Translating string: '${string}' into language(s): '${languages.join(
      ","
    )}'`,
  translateInputToAllLanguagesComplete: (string: string) =>
    `Finished translating string: '${string}'`,
  translateInputToAllLanguagesError: (string: string, err: Error) => [
    `Error when translating string: '${string}'`,
    err,
  ],
  updateDocument: (path: string) =>
    `Updating Cloud Firestore document: '${path}'`,
  updateDocumentComplete: (path: string) =>
    `Finished updating Cloud Firestore document: '${path}'`,
};
