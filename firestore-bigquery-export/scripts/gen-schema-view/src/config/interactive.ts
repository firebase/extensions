import inquirer from "inquirer";

const BIGQUERY_VALID_CHARACTERS = /^[a-zA-Z0-9_]+$/;
const FIRESTORE_VALID_CHARACTERS = /^[^\/]+$/;
const GCP_PROJECT_VALID_CHARACTERS = /^[a-z][a-z0-9-]{0,29}$/;

const validateInput = (value: any, name: string, regex: RegExp) => {
  if (!value || value === "" || value.trim() === "") {
    return `Please supply a ${name}`;
  }
  if (!value.match(regex)) {
    return `The ${name} must only contain letters or spaces`;
  }
  return true;
};

export const questions = [
  {
    message: "What is your Firebase project ID?",
    name: "project",
    type: "input",
    validate: (value) =>
      validateInput(value, "project ID", FIRESTORE_VALID_CHARACTERS),
  },
  {
    message:
      "What is your Google Cloud Project ID for BigQuery? (can be the same as the Firebase project ID)",
    name: "bigQueryProject",
    type: "input",
    validate: (value) =>
      validateInput(value, "BigQuery project ID", GCP_PROJECT_VALID_CHARACTERS),
  },
  {
    message:
      "What is the ID of the BigQuery dataset the raw changelog lives in? (The dataset and the raw changelog must already exist!)",
    name: "dataset",
    type: "input",
    validate: (value) =>
      validateInput(value, "dataset ID", BIGQUERY_VALID_CHARACTERS),
  },
  {
    message:
      "What prefix should be used for the names of the views generated by this script?",
    name: "tableNamePrefix",
    type: "input",
    validate: (value) =>
      validateInput(value, "table name prefix", BIGQUERY_VALID_CHARACTERS),
  },
  {
    message:
      "Would you like to use a Gemini to automatically analyze your data and generate a draft schema?",
    name: "useGemini",
    type: "confirm",
    default: false,
  },
  {
    message:
      "Where should this script look for schema definitions? (Enter a comma-separated list of, optionally globbed, paths to files or directories).",
    name: "schemaFiles",
    type: "input",
    when: (answers) => !answers.useGemini,
  },
  {
    message: "Please provide your Google AI API Key:",
    name: "googleAiKey",
    type: "password",
    when: (answers) => answers.useGemini,
    validate: (value) => {
      if (!value || value.trim() === "") {
        return "Google AI API Key is required";
      }
      return true;
    },
  },
  {
    message:
      "What is the Firestore collection path you want Gemini to analyze?",
    name: "geminiAnalyzeCollectionPath",
    type: "input",
    when: (answers) => answers.useGemini,
    validate: (value) =>
      validateInput(value, "collection path", FIRESTORE_VALID_CHARACTERS),
  },
  {
    message: "Where should the generated schema files be stored?",
    name: "schemaDirectory",
    type: "input",
    when: (answers) => answers.useGemini,
    default: "./schemas",
  },
];

export const promptInquirer = () => {
  return inquirer.prompt(questions);
};
