import { FirestoreSchema } from "../schema";
import { readSchemas } from "../schema-loader-utils";
import { promptInquirer } from "./interactive";
import { parseProgram, validateNonInteractiveParams } from "./non-interactive";

const DEFAULT_SAMPLE_SIZE = 100;

//  TODO: if you dont pass in a schema file (e.g use gemini to create one, the script fails)

export interface CliConfig {
  projectId: string;
  bigQueryProjectId: string;
  datasetId: string;
  tableNamePrefix: string;
  schemas: { [schemaName: string]: FirestoreSchema };
  useGemini?: boolean;
  agentSampleSize?: number;
  googleAiKey?: string;
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
      agentSampleSize: DEFAULT_SAMPLE_SIZE,
      googleAiKey: program.googleAiKey,
    };
  }
  const {
    project,
    bigQueryProject,
    dataset,
    tableNamePrefix,
    schemaFiles,
    useGemini,
    // TODO: rename?
    googleAiKey,
  } = await promptInquirer();

  return {
    projectId: project,
    bigQueryProjectId: bigQueryProject,
    datasetId: dataset,
    tableNamePrefix: tableNamePrefix,
    schemas: !useGemini ? readSchemas(
      schemaFiles.split(",").map((schemaFileName) => schemaFileName.trim())
    ) : {},
    useGemini: useGemini,
    agentSampleSize: DEFAULT_SAMPLE_SIZE,
    googleAiKey: googleAiKey,
  };
}
