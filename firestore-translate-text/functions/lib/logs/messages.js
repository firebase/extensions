"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messages = void 0;
exports.messages = {
    complete: () => "Completed execution of extension",
    documentCreatedNoInput: () => "Document was created without an input string, no processing is required",
    documentCreatedWithInput: () => "Document was created with an input string",
    documentDeleted: () => "Document was deleted, no processing is required",
    documentUpdatedChangedInput: () => "Document was updated, input string has changed",
    documentUpdatedDeletedInput: () => "Document was updated, input string was deleted",
    documentUpdatedNoInput: () => "Document was updated, no input string exists, no processing is required",
    documentUpdatedUnchangedInput: () => "Document was updated, input string has not changed, no processing is required",
    error: (err) => ["Failed execution of extension", err],
    fieldNamesNotDifferent: () => "The `Input` and `Output` field names must be different for this extension to function correctly",
    init: (config = {}) => [
        "Initializing extension with the parameter values",
        config,
    ],
    inputFieldNameIsOutputPath: () => "The `Input` field name must not be the same as an `Output` path for this extension to function correctly",
    start: (config = {}) => [
        "Started execution of extension with configuration",
        config,
    ],
    translateInputString: (string, language) => `Translating string: '${string}' into language(s): '${language}'`,
    translateStringComplete: (string, language) => `Finished translating string: '${string}' into language(s): '${language}'`,
    translateStringError: (string, language, err) => [
        `Error when translating string: '${string}' into language(s): '${language}'`,
        err,
    ],
    translateInputStringToAllLanguages: (string, languages) => `Translating string: '${string}' into language(s): '${languages.join(",")}'`,
    translateInputToAllLanguagesComplete: (string) => `Finished translating string: '${string}'`,
    translateInputToAllLanguagesError: (string, err) => [
        `Error when translating string: '${string}'`,
        err,
    ],
    updateDocument: (path) => `Updating Cloud Firestore document: '${path}'`,
    updateDocumentComplete: (path) => `Finished updating Cloud Firestore document: '${path}'`,
};
