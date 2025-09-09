/*
 * Copyright 2025 Google LLC
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

import { FirestoreSchema } from "../schema";
import { readSchemas } from "../schema-loader-utils";
import { promptInquirer } from "./interactive";
import { parseProgram, validateNonInteractiveParams } from "./non-interactive";

const DEFAULT_SAMPLE_SIZE = 100;

export interface CliConfig {
  projectId: string;
  bigQueryProjectId: string;
  datasetId: string;
  tableNamePrefix: string;
  schemas: { [schemaName: string]: FirestoreSchema };
  useGemini?: boolean;
  geminiAnalyzeCollectionPath?: string;
  agentSampleSize?: number;
  googleAiKey?: string;
  schemaDirectory?: string;
  geminiSchemaFileName?: string;
  isCollectionGroupQuery?: boolean;
}

export async function parseConfig(): Promise<CliConfig> {
  const program = parseProgram();
  if (program.nonInteractive) {
    if (!validateNonInteractiveParams(program)) {
      program.outputHelp();
      process.exit(1);
    }

    return {
      projectId: program.project,
      bigQueryProjectId: program.bigQueryProject || program.project,
      datasetId: program.dataset,
      tableNamePrefix: program.tableNamePrefix,
      useGemini: !!program.useGemini,
      schemas: !program.useGemini ? readSchemas(program.schemaFiles) : {},
      geminiAnalyzeCollectionPath: program.useGemini,
      agentSampleSize: DEFAULT_SAMPLE_SIZE,
      googleAiKey: program.googleAiKey,
      schemaDirectory: program.schemaDirectory,
      geminiSchemaFileName: program.geminiSchemaFileName,
      isCollectionGroupQuery: program.queryCollectionGroup,
    };
  }
  const {
    projectId,
    bigQueryProjectId,
    datasetId,
    tableNamePrefix,
    schemaFiles,
    useGemini,
    geminiAnalyzeCollectionPath,
    googleAiKey,
    schemaDirectory,
    geminiSchemaFileName,
    isCollectionGroupQuery,
  } = await promptInquirer();

  return {
    projectId,
    bigQueryProjectId,
    datasetId,
    tableNamePrefix,
    schemas: !useGemini ? readSchemas([schemaFiles]) : {},
    useGemini,
    geminiAnalyzeCollectionPath,
    agentSampleSize: DEFAULT_SAMPLE_SIZE,
    googleAiKey,
    schemaDirectory,
    geminiSchemaFileName,
    isCollectionGroupQuery,
  };
}
