import { program } from "commander";
import inquirer, { Question } from "inquirer";
import { validateLanguages } from "./languages";

interface CliConfig {
  projectId: string;
  languages: string[];
  collectionPath: string;
  inputFieldName: string;
  outputFieldName: string;
}

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
      "Into which target languages do you want to translate new strings? \n" +
      "The languages are identified using ISO-639-1 codes in a comma-separated list, for example: en,es,de,fr. \n" +
      "For these codes, visit the [supported languages list](https://cloud.google.com/translate/docs/languages).",
    name: "languages",
    type: "input",
    validate: (value) => validateLanguages(parseLanguages(value)),
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
];

export const parseConfig = async (options: any): Promise<CliConfig> => {
  if (options.nonInteractive) {
    if (
      !options.projectId ||
      !options.languages ||
      !options.collectionPath ||
      !options.inputFieldName ||
      !options.outputFieldName
    ) {
      program.help();
    } else {
      const parsedLanguages = parseLanguages(options.languages);
      const validation = validateLanguages(parsedLanguages);
      if (validation !== true) {
        program.error(validation);
      }

      return {
        projectId: options.projectId,
        languages: parsedLanguages,
        collectionPath: options.collectionPath,
        inputFieldName: options.inputFieldName,
        outputFieldName: options.outputFieldName,
      };
    }
  } else {
    const {
      projectId,
      languages,
      collectionPath,
      inputFieldName,
      outputFieldName,
    } = await inquirer.prompt(questions);

    return {
      projectId,
      languages: parseLanguages(languages),
      collectionPath,
      inputFieldName,
      outputFieldName,
    };
  }
};
