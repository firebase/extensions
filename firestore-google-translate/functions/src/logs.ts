import config from "./config";

export const complete = () => {
  console.log("Completed mod execution");
};

export const documentCreatedNoMsg = () => {
  console.log(
    "Document was created without a message, no processing is required"
  );
};

export const documentCreatedWithMsg = () => {
  console.log("Document was created with a message");
};

export const documentDeleted = () => {
  console.log("Document was deleted, no processing is required");
};

export const documentUpdatedChangedMsg = () => {
  console.log("Document was updated, message has changed");
};

export const documentUpdatedDeletedMsg = () => {
  console.log("Document was updated, message was deleted");
};

export const documentUpdatedNoMsg = () => {
  console.log(
    "Document was updated, no message exists, no processing is required"
  );
};

export const documentUpdatedUnchangedMsg = () => {
  console.log(
    "Document was updated, message has not changed, no processing is required"
  );
};

export const error = (err: Error) => {
  console.log("Failed mod execution", err);
};

export const init = () => {
  console.log("Initializing mod with configuration", config);
};

export const start = () => {
  console.log("Started mod execution with configuration", config);
};

export const translateMsg = (msg: string, language: string) => {
  console.log(`Translating msg: '${msg}' into language: '${language}'`);
};

export const translateMsgComplete = (msg: string, language: string) => {
  console.log(
    `Finished translating msg: '${msg}' into language: '${language}'`
  );
};

export const translateMsgError = (
  msg: string,
  language: string,
  err: Error
) => {
  console.error(
    `Error translating msg: '${msg}' into language: '${language}'`,
    err
  );
};

export const translateMsgAllLanguages = (msg: string, languages: string[]) => {
  console.log(
    `Translating msg: '${msg}' into languages: '${languages.join(",")}'`
  );
};

export const translateMsgAllLanguagesComplete = (msg: string) => {
  console.log(`Finished translating msg: '${msg}'`);
};

export const translateMsgAllLanguagesError = (msg: string, err: Error) => {
  console.error(`Error translating msg: '${msg}'`, err);
};

export const updateDocument = (path: string) => {
  console.log(`Updating Firestore Document: '${path}'`);
};

export const updateDocumentComplete = (path: string) => {
  console.log(`Finished updating Firestore Document: '${path}'`);
};
