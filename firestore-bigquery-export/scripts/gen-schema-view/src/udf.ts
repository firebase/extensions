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

import * as sqlFormatter from "sql-formatter";

// Persistent UDFs to be created on schema view initialization.
export const udfs: { [name: string]: (dataset: string) => any } = {
  firestoreArray: firestoreArrayFunction,
  firestoreBoolean: firestoreBooleanFunction,
  firestoreNumber: firestoreNumberFunction,
  firestoreTimestamp: firestoreTimestampFunction,
  firestoreGeopoint: firestoreGeopointFunction,
};

export function firestoreArray(datasetId: string, selector: string): string {
  return `\`${
    process.env.PROJECT_ID
  }.${datasetId}.firestoreArray\`(${selector})`;
}

export function firestoreBoolean(datasetId: string, selector: string): string {
  return `\`${
    process.env.PROJECT_ID
  }.${datasetId}.firestoreBoolean\`(${selector})`;
}

export function firestoreNumber(datasetId: string, selector: string): string {
  return `\`${
    process.env.PROJECT_ID
  }.${datasetId}.firestoreNumber\`(${selector})`;
}

export function firestoreTimestamp(
  datasetId: string,
  selector: string
): string {
  return `\`${
    process.env.PROJECT_ID
  }.${datasetId}.firestoreTimestamp\`(${selector})`;
}

export function firestoreGeopoint(datasetId: string, selector: string): string {
  return `\`${
    process.env.PROJECT_ID
  }.${datasetId}.firestoreGeopoint\`(${selector})`;
}

function firestoreArrayFunction(datasetId: string): any {
  const definition: string = firestoreArrayDefinition(datasetId);
  return {
    query: definition,
    useLegacySql: false,
  };
}

function firestoreArrayDefinition(datasetId: string): string {
  return sqlFormatter.format(`
    CREATE FUNCTION IF NOT EXISTS \`${
      process.env.PROJECT_ID
    }.${datasetId}.firestoreArray\`(json STRING)
    RETURNS ARRAY<STRING>
    LANGUAGE js AS """
    function getArray(json) {
      if(json) {
        const parsed = JSON.parse(json);
        
        if(Array.isArray(parsed)) {
          return parsed.map(x => JSON.stringify(x));
        }
        
        return [];
      }

      return [];
    }
    
    return getArray(json);
    """;`);
}

function firestoreBooleanFunction(datasetId: string): any {
  const definition: string = firestoreBooleanDefinition(datasetId);
  return {
    query: definition,
    useLegacySql: false,
  };
}

function firestoreBooleanDefinition(datasetId: string): string {
  return sqlFormatter.format(`
    CREATE FUNCTION IF NOT EXISTS \`${
      process.env.PROJECT_ID
    }.${datasetId}.firestoreBoolean\`(json STRING)
    RETURNS BOOLEAN AS (SAFE_CAST(json AS BOOLEAN));`);
}

function firestoreNumberFunction(datasetId: string): any {
  const definition: string = firestoreNumberDefinition(datasetId);
  return {
    query: definition,
    useLegacySql: false,
  };
}

function firestoreNumberDefinition(datasetId: string): string {
  return sqlFormatter.format(`
    CREATE FUNCTION IF NOT EXISTS \`${
      process.env.PROJECT_ID
    }.${datasetId}.firestoreNumber\`(json STRING)
    RETURNS NUMERIC AS (SAFE_CAST(json AS NUMERIC));`);
}

function firestoreTimestampFunction(datasetId: string): any {
  const definition: string = firestoreTimestampDefinition(datasetId);
  return {
    query: definition,
    useLegacySql: false,
  };
}

function firestoreTimestampDefinition(datasetId: string): string {
  return sqlFormatter.format(`
    CREATE FUNCTION IF NOT EXISTS \`${
      process.env.PROJECT_ID
    }.${datasetId}.firestoreTimestamp\`(json STRING)
    RETURNS TIMESTAMP AS
    (TIMESTAMP_MILLIS(SAFE_CAST(JSON_EXTRACT(json, '$._seconds') AS INT64) * 1000 + SAFE_CAST(SAFE_CAST(JSON_EXTRACT(json, '$._nanoseconds') AS INT64) / 1E6 AS INT64)));`);
}

function firestoreGeopointFunction(datasetId: string): any {
  const definition: string = firestoreGeopointDefinition(datasetId);
  return {
    query: definition,
    useLegacySql: false,
  };
}

function firestoreGeopointDefinition(datasetId: string): string {
  return sqlFormatter.format(`
    CREATE FUNCTION IF NOT EXISTS \`${
      process.env.PROJECT_ID
    }.${datasetId}.firestoreGeopoint\`(json STRING)
    RETURNS GEOGRAPHY AS
    (ST_GEOGPOINT(SAFE_CAST(JSON_EXTRACT(json, '$._longitude') AS NUMERIC), SAFE_CAST(JSON_EXTRACT(json, '$._latitude') AS NUMERIC)));`);
}
