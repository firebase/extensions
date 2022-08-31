import { program } from "commander";
import inquirer, { Question } from "inquirer";
import { validateLanguages } from "./languages";

const FIRESTORE_VALID_CHARACTERS = /^[^\/]+$/;
const PROJECT_ID_MAX_CHARS = 6144;
const FIRESTORE_COLLECTION_NAME_MAX_CHARS = 6144;

const validateInput = (
  value: string,
  name: string,
  regex: RegExp,
  sizeLimit: number
) => {
  if (!value || value === "" || value.trim() === "") {
    return `Please supply a ${name}`;
  }
  if (value.length >= sizeLimit) {
    return `${name} must be at most ${sizeLimit} characters long`;
  }
  if (!value.match(regex)) {
    return `The ${name} must only contain letters or spaces`;
  }
  return true;
};

const parseLanguages = (value: string) => {
  return value.split(",").map((l) => l.trim());
};

export const DEFAULT_BATCH_SIZE = 100;

const questions: Question[] = [
  {
    message: "What is your Firebase project ID?",
    name: "projectId",
    type: "input",
    validate: (value) =>
      validateInput(
        value,
        "project ID",
        FIRESTORE_VALID_CHARACTERS,
        PROJECT_ID_MAX_CHARS
      ),
  },
  {
    message:
      "What is the Google Cloud project ID would you like to use for the Translation API? (leave blank to use the same project as the Firebase project)",
    name: "gcProjectId",
    type: "input",
    validate: (value) =>
      !value
        ? true
        : validateInput(
            value,
            "Google Cloud project ID",
            FIRESTORE_VALID_CHARACTERS,
            PROJECT_ID_MAX_CHARS
          ),
  },
  {
    message:
      "What is the path to the collection that contains the strings that you want to translate?",
    name: "collectionPath",
    type: "input",
    validate: (value) =>
      validateInput(
        value,
        "collection path",
        FIRESTORE_VALID_CHARACTERS,
        FIRESTORE_COLLECTION_NAME_MAX_CHARS
      ),
  },
  {
    message:
      "Into which target languages do you want to translate new strings? \n" +
      "The languages are identified using ISO-639-1 codes in a comma-separated list, for example: en,es,de,fr. \n" +
      "For these codes, visit the [supported languages list](https://cloud.google.com/translate/docs/languages).",
    name: "languages",
    type: "input",
    validate: (value) => validateLanguages(parseLanguages(value)),
  },
  {
    message:
      "What is the name of the field that contains the string that you want to translate?",
    name: "inputFieldName",
    type: "input",
  },
  {
    message:
      "What is the name of the field where you want to store your translations?",
    name: "outputFieldName",
    type: "input",
  },
  {
    message:
      "What is the name of the field that contains the languages that you want to translate into? (leave blank if you want to translate into languages specified in the languages param)",
    name: "languagesFieldName",
    type: "input",
  },
  {
    message: "How many documents should be processed at once?",
    name: "batchSize",
    type: "input",
    default: DEFAULT_BATCH_SIZE,
    validate: (value) => {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) return "Please supply a valid number";
      else if (parsed < 1) return "Please supply a number greater than 0";
      else return true;
    },
  },
  {
    message: "Would you like to run the script across multiple threads?",
    name: "multiThreaded",
    type: "confirm",
    default: false,
  },
];

interface CliConfig {
  projectId: string;
  gcProjectId: string;
  collectionPath: string;
  languages: string[];
  inputFieldName: string;
  outputFieldName: string;
  languagesFieldName?: string;
  batchSize?: number;
  multiThreaded?: boolean;
}

export const parseConfig = async (options: any): Promise<CliConfig> => {
  const {
    projectId,
    gcProjectId,
    collectionPath,
    languages,
    inputFieldName,
    outputFieldName,
    languagesFieldName,
    batchSize,
    multiThreaded,
  } = options.nonInteractive ? options : await inquirer.prompt(questions);

  if (
    !projectId ||
    !collectionPath ||
    !languages ||
    !inputFieldName ||
    !outputFieldName
  ) {
    program.help();
  }

  return {
    projectId,
    gcProjectId: gcProjectId || projectId,
    collectionPath,
    languages: parseLanguages(languages),
    inputFieldName,
    outputFieldName,
    languagesFieldName,
    batchSize: parseInt(batchSize, 10),
    multiThreaded,
  };
};
