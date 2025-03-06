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
      useGemini: program.useGemini,
      schemas: !program.useGemini ? readSchemas(program.schemaFiles) : {},
      geminiAnalyzeCollectionPath: program.geminiAnalyzeCollectionPath,
      agentSampleSize: DEFAULT_SAMPLE_SIZE,
      googleAiKey: program.googleAiKey,
      schemaDirectory: program.schemaDirectory,
    };
  }
  const {
    project,
    bigQueryProject,
    dataset,
    tableNamePrefix,
    schemaFiles,
    useGemini,
    geminiAnalyzeCollectionPath,
    googleAiKey,
    schemaDirectory,
  } = await promptInquirer();

  return {
    projectId: project,
    bigQueryProjectId: bigQueryProject,
    datasetId: dataset,
    tableNamePrefix,
    schemas: !useGemini ? readSchemas([schemaFiles]) : {},
    useGemini,
    geminiAnalyzeCollectionPath,
    agentSampleSize: DEFAULT_SAMPLE_SIZE,
    googleAiKey,
    schemaDirectory,
  };
}
