/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as program from "commander";

const packageJson = require("../package.json");

export const getCLIOptions = () => {
  program
    .name("fs-bq-import-collection")
    .description(packageJson.description)
    .version(packageJson.version)
    .option(
      "--non-interactive",
      "Parse all input from command line flags instead of prompting the caller.",
      false
    )
    .option(
      "-P, --project <project>",
      "Firebase Project ID for project containing the Cloud Firestore database."
    )
    .option(
      "-B, --big-query-project <big-query-project>",
      "Google Cloud Project ID for BigQuery."
    )
    .option(
      "-q, --query-collection-group [true|false]",
      "Use 'true' for a collection group query, otherwise a collection query is performed."
    )
    .option(
      "-s, --source-collection-path <source-collection-path>",
      "The path of the the Cloud Firestore Collection to import from. (This may or may not be the same Collection for which you plan to mirror changes.)"
    )
    .option(
      "-d, --dataset <dataset>",
      "The ID of the BigQuery dataset to import to. (A dataset will be created if it doesn't already exist.)"
    )
    .option(
      "-t, --table-name-prefix <table-name-prefix>",
      "The identifying prefix of the BigQuery table to import to. (A table will be created if one doesn't already exist.)"
    )
    .option(
      "-b, --batch-size [batch-size]",
      "Number of documents to stream into BigQuery at once.",
      (value) => parseInt(value, 10),
      300
    )
    .option(
      "-l, --dataset-location <location>",
      "Location of the BigQuery dataset."
    )
    .option(
      "-m, --multi-threaded [true|false]",
      "Whether to run standard or multi-thread import version"
    )
    .option(
      "-u, --use-new-snapshot-query-syntax [true|false]",
      "Whether to use updated latest snapshot query"
    )
    .option(
      "-f, --transform-function-url <transform-function-url>",
      "URL of function to transform data before export (e.g., https://us-west1-project.cloudfunctions.net/transform)"
    )
    .option(
      "-e, --use-emulator [true|false]",
      "Whether to use the firestore emulator"
    )
    .option(
      "-f, --failed-batch-output <file>",
      "Path to the JSON file where failed batches will be recorded."
    )
    .option(
      "--firestore-instance-id <database-id>",
      "The Firestore database instance ID. Use '(default)' for the default database.",
      "(default)"
    );
};
