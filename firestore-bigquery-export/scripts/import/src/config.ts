import * as program from "commander";
import * as filenamify from "filenamify";
import * as inquirer from "inquirer";

import { CliConfig, CliConfigError } from "./types";

const BIGQUERY_VALID_CHARACTERS = /^[a-zA-Z0-9_]+$/;
// regex of ^[^/]+(/[^/]+/[^/]+)*$
export const FIRESTORE_VALID_CHARACTERS = new RegExp("^[^/]+(/[^/]+/[^/]+)*$");
// export const FIRESTORE_VALID_CHARACTERS = /^[^/]+(/[^/]+/[^/]+)*$/;
const GCP_PROJECT_VALID_CHARACTERS = /^[a-z][a-z0-9-]{0,29}$/;

const PROJECT_ID_MAX_CHARS = 6144;
export const FIRESTORE_COLLECTION_NAME_MAX_CHARS = 6144;
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
    "europe-central2",
    "europe-north1",
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

export const validateInput = (
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
    return `The ${name} does not match the regular expression provided`;
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
        GCP_PROJECT_VALID_CHARACTERS,
        PROJECT_ID_MAX_CHARS
      ),
  },
  {
    message: "What is your BigQuery project ID?",
    name: "bigQueryProject",
    type: "input",
    default: process.env.PROJECT_ID,
    validate: (value) =>
      validateInput(
        value,
        "BigQuery project ID",
        GCP_PROJECT_VALID_CHARACTERS,
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
  {
    message: "Would you like to use the new optimized snapshot query script?",
    name: "useNewSnapshotQuerySyntax",
    type: "confirm",
    default: false,
  },
  {
    message: "What's the URL of your transform function? (Optional)",
    name: "transformFunctionUrl",
    type: "input",
    default: "",
    validate: (value) => {
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return "Please enter a valid URL or leave empty";
      }
    },
  },
  {
    message: "Would you like to use a local firestore emulator?",
    name: "useEmulator",
    type: "confirm",
    default: false,
  },
  {
    message:
      "Where would you like to output the failed imports? (Leave blank to skip)",
    name: "failedBatchOutput",
    type: "input",
  },
];

export async function parseConfig(): Promise<CliConfig | CliConfigError> {
  program.parse(process.argv);

  if (program.nonInteractive) {
    const errors = [];
    if (program.project === undefined) {
      errors.push("Project is not specified.");
    }
    if (program.bigQueryProject === undefined) {
      program.bigQueryProject = program.project;
    }
    if (program.sourceCollectionPath === undefined) {
      errors.push("SourceCollectionPath is not specified.");
    }
    if (program.dataset === undefined) {
      errors.push("Dataset ID is not specified.");
    }
    if (program.tableNamePrefix === undefined) {
      errors.push("TableNamePrefix is not specified.");
    }
    if (program.queryCollectionGroup === undefined) {
      errors.push("QueryCollectionGroup is not specified.");
    }
    if (program.batchSize === undefined) {
      errors.push("BatchSize is not specified.");
    }
    if (program.datasetLocation === undefined) {
      errors.push("DatasetLocation is not specified.");
    }

    if (program.transformFunctionUrl) {
      try {
        new URL(program.transformFunctionUrl);
      } catch {
        errors.push("Transform function URL is invalid");
      }
    }

    if (!validateBatchSize(program.batchSize)) {
      errors.push("Invalid batch size.");
    }

    if (errors.length !== 0) {
      program.outputHelp();
      return { kind: "ERROR", errors };
    }

    const rawChangeLogName = `${program.tableNamePrefix}_raw_changelog`;
    const cursorPositionFile = getCursorPositionFile(
      program.sourceCollectionPath,
      program.project,
      program.dataset,
      rawChangeLogName
    );

    return {
      kind: "CONFIG",
      projectId: program.project,
      bigQueryProjectId: program.bigQueryProject,
      sourceCollectionPath: program.sourceCollectionPath,
      datasetId: program.dataset,
      tableId: program.tableNamePrefix,
      batchSize: parseInt(program.batchSize),
      queryCollectionGroup: program.queryCollectionGroup === "true",
      datasetLocation: program.datasetLocation,
      multiThreaded: program.multiThreaded === "true",
      useNewSnapshotQuerySyntax: program.useNewSnapshotQuerySyntax === "true",
      useEmulator: program.useEmulator === "true",
      rawChangeLogName,
      cursorPositionFile,
      failedBatchOutput: program.failedBatchOutput,
    };
  }
  const {
    project,
    sourceCollectionPath,
    bigQueryProject,
    dataset,
    table,
    batchSize,
    queryCollectionGroup,
    datasetLocation,
    multiThreaded,
    useNewSnapshotQuerySyntax,
    useEmulator,
    failedBatchOutput,
  } = await inquirer.prompt(questions);

  const rawChangeLogName = `${table}_raw_changelog`;
  const cursorPositionFile = getCursorPositionFile(
    sourceCollectionPath,
    project,
    dataset,
    rawChangeLogName
  );

  return {
    kind: "CONFIG",
    projectId: project,
    bigQueryProjectId: bigQueryProject,
    sourceCollectionPath: sourceCollectionPath,
    datasetId: dataset,
    tableId: table,
    batchSize: parseInt(batchSize),
    queryCollectionGroup: queryCollectionGroup,
    datasetLocation: datasetLocation,
    multiThreaded: multiThreaded,
    useNewSnapshotQuerySyntax: useNewSnapshotQuerySyntax,
    useEmulator: useEmulator,
    rawChangeLogName,
    cursorPositionFile,
    failedBatchOutput,
  };
}

/**
 *
 * @param template - eg, regions/{regionId}/countries
 * @param text - eg, regions/asia/countries
 *
 * @return - eg, { regionId: "asia" }
 */
export const resolveWildcardIds = (template: string, text: string) => {
  const textSegments = text.split("/");
  return template
    .split("/")
    .reduce((previousValue, currentValue, currentIndex) => {
      if (currentValue.startsWith("{") && currentValue.endsWith("}")) {
        previousValue[currentValue.slice(1, -1)] = textSegments[currentIndex];
      }
      return previousValue;
    }, {});
};

function getCursorPositionFile(
  sourceCollectionPath: string,
  projectId: string,
  datasetId: string,
  rawChangeLogName: string
) {
  // TODO: make this part of config, set it in CliConfig
  const formattedPath = filenamify(sourceCollectionPath);
  return (
    __dirname +
    `/from-${formattedPath}-to-${projectId}_${datasetId}_${rawChangeLogName}`
  );
}
