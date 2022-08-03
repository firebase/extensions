import * as inquirer from "inquirer";
import * as program from "commander";

import { CliConfig } from "./types";

const BIGQUERY_VALID_CHARACTERS = /^[a-zA-Z0-9_]+$/;
const FIRESTORE_VALID_CHARACTERS = /^[^\/]+$/;

const PROJECT_ID_MAX_CHARS = 6144;
const FIRESTORE_COLLECTION_NAME_MAX_CHARS = 6144;
const BIGQUERY_RESOURCE_NAME_MAX_CHARS = 1024;

const validateBatchSize = (value: string) => {
  return parseInt(value, 10) > 0;
};

const validateLocation = (value: string) => {
  const index = [
    "us-west4",
    "us-west2",
    "northamerica-northeast1",
    "us-east4",
    "us-west1",
    "us-west3",
    "southamerica-east1",
    "us-east1",
    "europe-west1",
    "europe-north1",
    "europe-west3",
    "europe-west2",
    "europe-west4",
    "europe-west4",
    "europe-west6",
    "asia-east2",
    "asia-southeast2",
    "asia-south1",
    "asia-northeast2",
    "asia-northeast3",
    "asia-southeast1",
    "australia-southeast1",
    "asia-east1",
    "asia-northeast1",
    "us",
    "eu",
  ].indexOf(value.toLowerCase());

  return index !== -1;
};

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

const questions = [
  {
    message: "What is your Firebase project ID?",
    name: "project",
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
      "What is the path of the the Cloud Firestore Collection you would like to import from? " +
      "(This may, or may not, be the same Collection for which you plan to mirror changes.)",
    name: "sourceCollectionPath",
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
    message: "Would you like to import documents via a Collection Group query?",
    name: "queryCollectionGroup",
    type: "confirm",
    default: false,
  },
  {
    message:
      "What is the ID of the BigQuery dataset that you would like to use? (A dataset will be created if it doesn't already exist)",
    name: "dataset",
    type: "input",
    validate: (value) =>
      validateInput(
        value,
        "dataset",
        BIGQUERY_VALID_CHARACTERS,
        BIGQUERY_RESOURCE_NAME_MAX_CHARS
      ),
  },
  {
    message:
      "What is the identifying prefix of the BigQuery table that you would like to import to? (A table will be created if one doesn't already exist)",
    name: "table",
    type: "input",
    validate: (value) =>
      validateInput(
        value,
        "table",
        BIGQUERY_VALID_CHARACTERS,
        BIGQUERY_RESOURCE_NAME_MAX_CHARS
      ),
  },
  {
    message:
      "How many documents should the import stream into BigQuery at once?",
    name: "batchSize",
    type: "input",
    default: 300,
    validate: validateBatchSize,
  },
  {
    message: "Where would you like the BigQuery dataset to be located?",
    name: "datasetLocation",
    type: "input",
    default: "us",
    validate: validateLocation,
  },
  {
    message: "Would you like to run the import across multiple threads?",
    name: "multiThreaded",
    type: "confirm",
    default: false,
  },
];

export async function parseConfig(): Promise<CliConfig> {
  program.parse(process.argv);

  if (program.nonInteractive) {
    if (
      program.project === undefined ||
      program.sourceCollectionPath === undefined ||
      program.dataset === undefined ||
      program.tableNamePrefix === undefined ||
      program.queryCollectionGroup === undefined ||
      program.batchSize === undefined ||
      program.datasetLocation === undefined ||
      program.multiThreaded === undefined ||
      !validateBatchSize(program.batchSize)
    ) {
      program.outputHelp();
      process.exit(1);
    }
    return {
      projectId: program.project,
      sourceCollectionPath: program.sourceCollectionPath,
      datasetId: program.dataset,
      tableId: program.tableNamePrefix,
      batchSize: program.batchSize,
      queryCollectionGroup: program.queryCollectionGroup === "true",
      datasetLocation: program.datasetLocation,
      multiThreaded: program.multiThreaded === "true",
    };
  }
  const {
    project,
    sourceCollectionPath,
    dataset,
    table,
    batchSize,
    queryCollectionGroup,
    datasetLocation,
    multiThreaded,
  } = await inquirer.prompt(questions);
  return {
    projectId: project,
    sourceCollectionPath: sourceCollectionPath,
    datasetId: dataset,
    tableId: table,
    batchSize: batchSize,
    queryCollectionGroup: queryCollectionGroup,
    datasetLocation: datasetLocation,
    multiThreaded: multiThreaded,
  };
}
