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

import { FirestoreBigQueryEventHistoryTrackerConfig } from "./types";
import { BigQueryFieldMode, BigQueryFieldType } from "./types";

const NULLABLE = BigQueryFieldMode.NULLABLE;
const REQUIRED = BigQueryFieldMode.REQUIRED;
const TIMESTAMP = BigQueryFieldType.TIMESTAMP;
const STRING = BigQueryFieldType.STRING;
const JSON = BigQueryFieldType.JSON;

class BigQueryField {
  name: string;
  type: BigQueryFieldType;
  mode: BigQueryFieldMode;
  description?: string;
  fields?: BigQueryField[];

  constructor(
    name: string,
    type?: BigQueryFieldType,
    mode?: BigQueryFieldMode,
    description?: string,
    fields?: BigQueryField[]
  ) {
    this.name = name;
    this.mode = mode || BigQueryFieldMode.NULLABLE;
    this.type = type || BigQueryFieldType.STRING;
    if (this.description) {
      this.description = description;
    }
    if (this.fields) {
      this.fields = fields;
    }
  }

  withDescription(description: string): BigQueryField {
    this.description = description;
    return this;
  }
  withMode(mode: BigQueryFieldMode): BigQueryField {
    this.mode = mode;
    return this;
  }
  withType(type: BigQueryFieldType): BigQueryField {
    this.type = type;
    return this;
  }
  withFields(fields: BigQueryField[]): BigQueryField {
    this.fields = fields;
    return this;
  }
  addToDescription(descriptionSuffix: string): BigQueryField {
    if (this.description) {
      this.description += descriptionSuffix;
      return this;
    }
    this.description = descriptionSuffix;
    return this;
  }
}

export const timestampField = new BigQueryField(
  "timestamp",
  TIMESTAMP
).withMode(REQUIRED);

export const documentIdField = new BigQueryField("document_id").withDescription(
  "The document id as defined in the firestore database."
);

export const documentPathParamsField = new BigQueryField(
  "path_params"
).withDescription(
  "JSON string representing wildcard params with Firestore Document ids"
);

const eventIdField = new BigQueryField("event_id").withDescription(
  "The ID of the most-recent document change event that triggered the Cloud Function created by the extension. Empty for imports."
);

const documentNameField = new BigQueryField("document_name").withDescription(
  "The full name of the changed document, for example, projects/collection/databases/(default)/documents/users/me)."
);

const operationField = new BigQueryField("operation").withDescription(
  "One of CREATE, UPDATE, IMPORT"
);

const dataField = new BigQueryField("data").withDescription(
  "The full JSON representation of the document state after the indicated operation is applied."
);

export const oldDataField = new BigQueryField("old_data").withDescription(
  "The full JSON representation of the document state before the indicated operation is applied. This field will be null for CREATE operations."
);

/*
 * We cannot specify a schema for view creation, and all view columns default
 * to the NULLABLE mode.
 */

export const RawChangelogViewSchema = (
  dataFormat: BigQueryFieldType.STRING | BigQueryFieldType.JSON
) => ({
  fields: [
    timestampField
      .withMode(NULLABLE)
      .withDescription(
        "The commit timestamp of this change in Cloud Firestore. If the operation is IMPORT, this timestamp is epoch to ensure that any operation on an imported document supersedes the IMPORT."
      ),
    eventIdField,
    documentNameField,
    operationField.addToDescription("."),
    dataField.withType(dataFormat),
    oldDataField,
    documentIdField,
  ],
});

export const RawChangelogSchema = (
  dataFormat: BigQueryFieldType.STRING | BigQueryFieldType.JSON
) => ({
  fields: [
    timestampField
      .withMode(REQUIRED)
      .withDescription(
        "The commit timestamp of this change in Cloud Firestore. If the operation is IMPORT, this timestamp is epoch to ensure that any operation on an imported document supersedes the IMPORT."
      ),
    eventIdField.withMode(REQUIRED),
    documentNameField.withMode(REQUIRED),
    operationField.withMode(REQUIRED).addToDescription(", or DELETE."),
    dataField
      .addToDescription(" This field will be null for DELETE operations.")
      .withType(dataFormat),
    oldDataField,
    documentIdField,
  ],
});

// Helper function for Partitioned Changelogs field
export const getNewPartitionField = (
  config: FirestoreBigQueryEventHistoryTrackerConfig
) => {
  const { timePartitioningField, timePartitioningFieldType } = config;

  return {
    name: timePartitioningField,
    mode: BigQueryFieldMode.NULLABLE,
    type: timePartitioningFieldType,
    description: "The document TimePartition partition field selected by user",
  };
};
