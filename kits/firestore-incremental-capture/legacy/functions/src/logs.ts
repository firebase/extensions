/**
 * Copyright 2023 Google LLC
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

import { logger } from "firebase-functions";

export const bigQueryDatasetExists = (dataset: string) => {
  logger.log(`${dataset} already exists`);
};

export const bigQueryTableExists = (dataset: string) => {
  logger.log(`${dataset} already exists`);
};

export const bigQueryDatasetCreating = (dataset: string) => {
  logger.log(`Creating dataset: ${dataset}`);
};

export const bigQueryTableCreating = (table: string) => {
  logger.log(`Creating table: ${table}`);
};

export const bigQueryDatasetCreated = (dataset: string) => {
  logger.log(`successfully created dataset: ${dataset}`);
};

export const bigQueryTableCreated = (table: string) => {
  logger.log(`successfully created table: ${table}`);
};

export const tableCreationError = (table: string, message: string) => {
  logger.log(`error creating table: ${table}, ${message}`);
};

export const datasetCeationError = (dataset: string) => {
  logger.log(`error creatign dataset: ${dataset}`);
};
