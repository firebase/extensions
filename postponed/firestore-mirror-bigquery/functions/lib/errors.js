"use strict";
/*
 * Copyright 2019 Google LLC
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.changedFieldMode = (fieldName, bqMode, schemaMode) =>
  new Error(
    `Field ${fieldName} has different field mode. BigQuery mode: ${bqMode}; Schema mode: ${schemaMode}`
  );
exports.changedFieldType = (fieldName, bqType, schemaType) =>
  new Error(
    `Field: ${fieldName} has changed field type. BigQuery type: ${bqType}; Schema type: ${schemaType}`
  );
exports.invalidFieldDefinition = (field) =>
  new Error(`Invalid field definition: ${JSON.stringify(field)}`);
