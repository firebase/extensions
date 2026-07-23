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

export const changedFieldMode = (
  fieldName: string,
  bqMode: string,
  schemaMode: string
) =>
  new Error(
    `Field ${fieldName} has different field mode. BigQuery mode: ${bqMode}; Schema mode: ${schemaMode}`
  );

export const changedFieldType = (
  fieldName: string,
  bqType: string,
  schemaType: string
) =>
  new Error(
    `Field: ${fieldName} has changed field type. BigQuery type: ${bqType}; Schema type: ${schemaType}`
  );
